# Node.js Internals Deep Dive

> Topics covered: Async Context Tracking, Buffers, V8 Memory Model, Clusters — with real-world examples and interview Q&A.

---

## Table of Contents

1. Asynchronous Context Tracking
2. Real World Example: Express + Tracing
3. Buffers in Node.js
4. Interview Q&A: Buffers
5. V8 Memory Model
6. Clusters in Node.js
7. Interview Q&A: Clusters

---

## 1. Asynchronous Context Tracking

### The Problem

In synchronous code, you can store state in a variable. In async code, that breaks — multiple concurrent requests share the same scope, so you can't tell which "context" you're in.

```js
// Broken: requestId gets overwritten across concurrent requests
let requestId;

app.get('/', (req, res) => {
  requestId = req.headers['x-request-id']; // overwritten by next request!
  someAsyncOperation().then(() => {
    console.log(requestId); // wrong value
  });
});
```

### The Solution: `AsyncLocalStorage`

Node.js provides `AsyncLocalStorage` (stable since v16) in the `async_hooks` module. It maintains context across async boundaries — callbacks, promises, timers — automatically.

```js
import { AsyncLocalStorage } from 'async_hooks';

const store = new AsyncLocalStorage();

app.get('/', (req, res) => {
  const context = { requestId: req.headers['x-request-id'] };

  store.run(context, async () => {
    await someAsyncOperation();
    console.log(store.getStore().requestId); // correct, always
    res.send('ok');
  });
});

async function someAsyncOperation() {
  await fetch('https://api.example.com');
  console.log(store.getStore().requestId); // still correct, deep in the call stack
}
```

### How It Works Internally

Node.js assigns every async operation an **async ID** and tracks a **trigger async ID** (the parent that created it). `AsyncLocalStorage` hooks into this lifecycle:

```
Request A ──► store.run(ctxA, fn)
                 └──► setTimeout(cb)   ← cb inherits ctxA
                         └──► fetch()  ← still ctxA

Request B ──► store.run(ctxB, fn)
                 └──► setTimeout(cb)   ← cb inherits ctxB
```

Each async "leaf" knows its lineage and can look up the right store.

### Key API

MethodDescription`store.run(value, fn)`Runs `fn` with `value` as the current context`store.getStore()`Returns current context (returns `undefined` if outside a `run`)`store.enterWith(value)`Sets context for the rest of the current async resource (use sparingly)`store.disable()`Tears down the store

### Common Use Cases

**1. Request-scoped logging (trace IDs)**

```js
const logCtx = new AsyncLocalStorage();

app.use((req, res, next) => {
  logCtx.run({ traceId: crypto.randomUUID() }, next);
});

function log(msg) {
  const { traceId } = logCtx.getStore() ?? {};
  console.log(`[${traceId}] ${msg}`);
}
```

**2. Database transactions**

```js
const txStore = new AsyncLocalStorage();

async function withTransaction(fn) {
  const tx = await db.beginTransaction();
  return txStore.run(tx, async () => {
    try {
      const result = await fn();
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  });
}

function getCurrentTx() {
  return txStore.getStore();
}
```

**3. Auth context**

```js
const userStore = new AsyncLocalStorage();

app.use(authMiddleware); // sets userStore via store.run(user, next)

function getCurrentUser() {
  return userStore.getStore();
}
```

### `AsyncResource` — Manual Binding

When you create async resources outside a `run()` context (e.g., worker threads, event emitters), use `AsyncResource` to manually bind context:

```js
import { AsyncResource } from 'async_hooks';

class MyWorker extends AsyncResource {
  constructor() {
    super('MyWorker');
  }

  doWork(callback) {
    this.runInAsyncScope(callback); // restores context when called
  }
}
```

### Performance Note

`AsyncLocalStorage` has near-zero overhead in modern Node.js (v22+). In older versions (v14–v16), it could be slower due to the underlying `async_hooks` implementation. The internals were rewritten using V8's native `AsyncContext` proposal, making it production-safe.

### Summary

ConceptPurpose`AsyncLocalStorage`Store per-request/per-operation context across async hops`store.run()`Create an isolated context scope`store.getStore()`Read the current context anywhere in the async tree`AsyncResource`Manually propagate context to manually-managed async resources

> It's essentially **thread-local storage for async Node.js** — the idiomatic way to avoid passing context through every function parameter.

---

## 2. Real World Example: Express + Tracing

A realistic setup — trace ID flows through middleware → routes → services → DB layer, with structured logging at every level.

### Project Structure

```
src/
├── tracing.js       # the store
├── logger.js        # trace-aware logger
├── db.js            # fake DB layer
├── userService.js   # business logic
└── app.js           # express app
```

### `src/tracing.js`

```js
import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

export const traceStore = new AsyncLocalStorage();

export function getTraceContext() {
  return traceStore.getStore();
}

export function createTraceContext(req) {
  return {
    traceId: req.headers['x-trace-id'] ?? crypto.randomUUID(),
    spanId:  crypto.randomUUID().slice(0, 8),
    method:  req.method,
    path:    req.path,
    startAt: Date.now(),
  };
}
```

### `src/logger.js`

```js
import { getTraceContext } from './tracing.js';

function buildEntry(level, msg, meta = {}) {
  const ctx = getTraceContext() ?? {};
  return JSON.stringify({
    level,
    msg,
    traceId: ctx.traceId,
    spanId:  ctx.spanId,
    ...meta,
    ts: new Date().toISOString(),
  });
}

export const logger = {
  info:  (msg, meta) => console.log(buildEntry('info',  msg, meta)),
  warn:  (msg, meta) => console.warn(buildEntry('warn', msg, meta)),
  error: (msg, meta) => console.error(buildEntry('error', msg, meta)),
};
```

### `src/db.js`

```js
import { logger } from './logger.js';

export async function queryDB(sql, params) {
  const t = Date.now();
  await new Promise(r => setTimeout(r, Math.random() * 50));

  logger.info('db.query', { sql, params, durationMs: Date.now() - t });

  if (sql.includes('NOT_FOUND')) return null;
  return { id: params[0], name: 'Alice', email: 'alice@example.com' };
}
```

### `src/userService.js`

```js
import { logger } from './logger.js';
import { queryDB } from './db.js';

export async function getUserById(id) {
  logger.info('userService.getUserById', { userId: id });

  const user = await queryDB('SELECT * FROM users WHERE id = ?', [id]);

  if (!user) {
    logger.warn('userService.notFound', { userId: id });
    return null;
  }

  logger.info('userService.found', { userId: id });
  return user;
}
```

### `src/app.js`

```js
import express from 'express';
import { traceStore, createTraceContext, getTraceContext } from './tracing.js';
import { logger } from './logger.js';
import { getUserById } from './userService.js';

const app = express();

// Tracing middleware
app.use((req, res, next) => {
  const ctx = createTraceContext(req);
  res.setHeader('x-trace-id', ctx.traceId);
  traceStore.run(ctx, () => {
    logger.info('request.start');
    next();
  });
});

// Response-time logging middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    const ctx = getTraceContext();
    if (!ctx) return;
    logger.info('request.end', {
      status:     res.statusCode,
      durationMs: Date.now() - ctx.startAt,
    });
  });
  next();
});

// Routes
app.get('/users/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('request.error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000, () => console.log('Listening on :3000'));
```

### What the Logs Look Like

Two concurrent requests — no pollution between them:

```json
{"level":"info","msg":"request.start",  "traceId":"a1b2-...","spanId":"f3c9a1b2"}
{"level":"info","msg":"request.start",  "traceId":"c3d4-...","spanId":"e7f0c3d4"}
{"level":"info","msg":"userService.getUserById","traceId":"a1b2-...","userId":"42"}
{"level":"info","msg":"userService.getUserById","traceId":"c3d4-...","userId":"99"}
{"level":"info","msg":"db.query",        "traceId":"c3d4-...","durationMs":23}
{"level":"info","msg":"db.query",        "traceId":"a1b2-...","durationMs":41}
{"level":"info","msg":"userService.found","traceId":"a1b2-...","userId":"42"}
{"level":"info","msg":"request.end",    "traceId":"a1b2-...","status":200,"durationMs":45}
{"level":"info","msg":"request.end",    "traceId":"c3d4-...","status":200,"durationMs":28}
```

### Key Points

- `traceStore.run(ctx, () => next())` — the entire request lifecycle inherits this context
- `logger.js` calls `getTraceContext()` at log time — always gets the current request's context
- `res.on('finish')` fires asynchronously but still has the correct context
- Works across `await`, `setTimeout`, event emitters — anything Node.js schedules

---

## 3. Buffers in Node.js

### Why Buffers Exist

JavaScript strings are UTF-16 encoded — great for text, useless for raw binary data (files, images, network packets, crypto). `Buffer` is Node's solution: a **fixed-size chunk of raw memory** outside the V8 heap.

```
V8 Heap          │  Outside V8 (C++ land)
─────────────────┼──────────────────────────
String, Object   │  Buffer (raw bytes)
Array, etc.      │  ← allocated directly in memory
```

### Creating Buffers

```js
// From a string
const b1 = Buffer.from('hello', 'utf8');
console.log(b1); // <Buffer 68 65 6c 6c 6f>

// From an array of bytes
const b2 = Buffer.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]);

// Allocate empty buffer (zero-filled, safe)
const b3 = Buffer.alloc(10);

// Allocate uninitialized (fast, but contains old memory)
const b4 = Buffer.allocUnsafe(10);

// From an ArrayBuffer
const ab = new ArrayBuffer(8);
const b5 = Buffer.from(ab);
```

> **Never use** `new Buffer()` — deprecated and unsafe.

### Reading & Writing

```js
const buf = Buffer.alloc(6);

buf.writeUInt8(255, 0);
buf.writeUInt16BE(1000, 1);

buf.readUInt8(0);     // 255
buf.readUInt16BE(1);  // 1000

buf[0] = 0xff;
console.log(buf[0]); // 255
```

### Encodings

```js
const buf = Buffer.from('hello world', 'utf8');

buf.toString('utf8');    // 'hello world'
buf.toString('hex');     // '68656c6c6f20776f726c64'
buf.toString('base64');  // 'aGVsbG8gd29ybGQ='
```

### Slicing & Copying

```js
const buf = Buffer.from('Hello, World!');

// slice — shares memory (no copy!)
const slice = buf.subarray(0, 5);
slice[0] = 0x4a;
console.log(buf.toString()); // 'Jello, World!' — original mutated!

// copy — independent
const copy = Buffer.allocUnsafe(5);
buf.copy(copy, 0, 7, 12);
console.log(copy.toString()); // 'World'

// concat
const merged = Buffer.concat([Buffer.from('Hello'), Buffer.from(' World')]);
console.log(merged.toString()); // 'Hello World'
```

> `subarray()` does **not copy** — mutations affect the original.

### Comparing Buffers

```js
const a = Buffer.from('ABC');
const b = Buffer.from('ABC');

a.equals(b);            // true
Buffer.compare(a, b);   // 0 (equal)

[c, a, b].sort(Buffer.compare);
```

### Buffer ↔ Stream

```js
import fs from 'fs';

const chunks = [];
fs.createReadStream('file.bin')
  .on('data', (chunk) => chunks.push(chunk))  // chunk is a Buffer
  .on('end', () => {
    const full = Buffer.concat(chunks);
    console.log(`Read ${full.length} bytes`);
  });
```

### Memory Layout & Performance

```
Buffer.alloc(1024)       → zero-filled, safe, slightly slower
Buffer.allocUnsafe(1024) → uninitialized, faster

Node reuses a pre-allocated 8KB pool for small buffers (< 4KB).
allocUnsafe pulls from this pool — hence "unsafe" (old data may remain).
```

### Quick Reference

MethodPurpose`Buffer.from(str, enc)`String → Buffer`Buffer.alloc(n)`Zeroed buffer of n bytes`Buffer.allocUnsafe(n)`Fast uninitialized buffer`Buffer.concat([...bufs])`Merge buffers`buf.toString(enc)`Buffer → String`buf.subarray(s, e)`Slice (shared memory)`buf.copy(target, ...)`Copy bytes into another buffer`buf.equals(other)`Byte-for-byte comparison`buf.length`Size in bytes`buf.readUInt8/16/32`Read numeric values`buf.writeUInt8/16/32`Write numeric values

### When You'll Actually Use Buffers

- **File I/O** — reading binary files (images, PDFs, ZIPs)
- **Crypto** — `crypto.createHash()`, `crypto.randomBytes()` return Buffers
- **Networking** — TCP/UDP sockets, raw HTTP body parsing
- **Encoding/decoding** — base64, hex conversion
- **Binary protocols** — parsing fixed-format binary data (DNS packets, custom wire formats)

---

## 4. Interview Q&A: Buffers

### Conceptual (Junior)

---

**Q: What is a Buffer in Node.js and why does it exist?**

A `Buffer` is a fixed-size region of raw memory allocated **outside the V8 heap**, used to handle binary data directly.

JavaScript was designed for the browser with no native way to deal with binary streams like file contents, TCP packets, or image bytes. Node.js needed to work with these at the OS/network level, so `Buffer` was introduced as a core primitive.

```js
const buf = Buffer.from('hello');
console.log(buf); // <Buffer 68 65 6c 6c 6f>
```

---

**Q: Why can't you use regular JavaScript strings for binary data?**

Three reasons:

1. **Encoding loss** — JS strings are UTF-16. Converting binary → string → binary corrupts bytes that don't map to valid Unicode.

```js
const binary = Buffer.from([0x80, 0x81, 0x82]);
const str = binary.toString('utf8');       // replacement chars: ���
const back = Buffer.from(str, 'utf8');
// NOT the same bytes — data corrupted
```

2. **Memory inefficiency** — UTF-16 uses 2 bytes per character minimum. A 1MB binary file stored as a string uses 2MB of heap memory.

3. **No byte-level access** — you can't efficiently read/write integers, floats, or structured binary formats from a string.

---

**Q: Where is Buffer memory allocated — inside or outside the V8 heap? Why does that matter?**

Outside the V8 heap, in C++ managed memory.

- **No GC pressure** — V8's garbage collector doesn't scan Buffer memory
- **Direct I/O** — OS system calls can write directly into Buffer memory without copying through V8
- **Size limits** — V8 heap has limits (\~1.5GB). Buffer memory is limited by available RAM

```
Without Buffer: OS → C++ copy → V8 heap (2x memory, GC pressure)
With Buffer:    OS → Buffer memory (direct, zero-copy path possible)
```

---

**Q: What's the difference between** `Buffer.alloc()` **and** `Buffer.allocUnsafe()`**?**

```js
Buffer.alloc(10)        // 10 zero-filled bytes — safe, predictable
Buffer.allocUnsafe(10)  // 10 bytes of whatever was in memory — fast, unpredictable
```

`alloc` zeroes out memory before returning. Slightly slower due to the memset operation.

`allocUnsafe` skips zeroing. Faster, but the buffer may contain arbitrary old memory — previous request data, passwords, private keys, etc.

**Use** `allocUnsafe` **only when you'll immediately write to every byte before reading.**

---

**Q: Why is** `new Buffer()` **deprecated?**

`new Buffer(number)` behaved like `allocUnsafe` — uninitialized memory — but it wasn't obvious. Developers who wrote `new Buffer(userInput)` were accidentally:

1. Exposing server memory if `userInput` was a number
2. Creating security vulnerabilities (memory disclosure)

Node split it into explicit, unambiguous methods: `Buffer.alloc()`, `Buffer.allocUnsafe()`, `Buffer.from()`.

---

### Behavioral / Tricky (Mid-level)

---

**Q: What does this print and why?**

```js
const a = Buffer.from('Hello');
const b = a.subarray(0, 3);
b[0] = 0x58; // 'X'
console.log(a.toString());
```

**Answer:** `Xello`

`subarray()` does not copy — it returns a view into the same underlying `ArrayBuffer`. Mutating `b` mutates `a`.

**Fix:**

```js
const b = Buffer.from(a.subarray(0, 3)); // true copy
```

---

**Q: Does** `buf.length` **equal character count?**

No. `buf.length` is always **bytes**, not characters.

```js
Buffer.from('hello').length    // 5 — ASCII, 1 byte each
Buffer.from('你好').length     // 6 — 3 bytes per Chinese character in UTF-8
Buffer.from('😀').length       // 4 — emoji is 4 bytes in UTF-8
```

Slicing at a byte offset can corrupt multi-byte characters:

```js
const buf = Buffer.from('你好');
buf.subarray(0, 2).toString('utf8'); // '??' — split mid-character
buf.subarray(0, 3).toString('utf8'); // '你' — correct
```

---

**Q: Does** `Buffer.concat()` **mutate input buffers?**

No. It allocates a new buffer and copies all inputs into it.

```js
const a = Buffer.from('Hello');
const b = Buffer.from(' World');
const c = Buffer.concat([a, b]);

c[0] = 0x58;
console.log(a.toString()); // 'Hello' — not mutated
```

---

### Practical / Coding (Mid-Senior)

---

**Q: Convert a base64 string to UTF-8**

```js
const base64 = 'aGVsbG8gd29ybGQ=';
const decoded = Buffer.from(base64, 'base64').toString('utf8');
// 'hello world'

// Reverse
const encoded = Buffer.from('hello world', 'utf8').toString('base64');
// 'aGVsbG8gd29ybGQ='
```

---

**Q: How do you implement a simple XOR cipher on a Buffer?**

```js
function xorCipher(data, key) {
  const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key);
  const result = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBuf[i % keyBuf.length];
  }
  return result;
}

const plaintext = Buffer.from('Hello World');
const key = Buffer.from('secret');
const encrypted = xorCipher(plaintext, key);
const decrypted = xorCipher(encrypted, key); // XOR is its own inverse
console.log(decrypted.toString()); // 'Hello World'
```

---

**Q: How do you parse a fixed binary protocol?**

Format: `[4 bytes: msg length][1 byte: msg type][N bytes: payload]`

```js
function parseMessage(buf) {
  if (buf.length < 5) throw new Error('Buffer too small for header');

  const msgLength = buf.readUInt32BE(0);
  const msgType   = buf.readUInt8(4);
  const payload   = buf.subarray(5, 5 + msgLength);

  if (payload.length < msgLength) throw new Error('Incomplete message');

  return { msgType, payload };
}

function buildMessage(type, data) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const buf = Buffer.allocUnsafe(5 + payload.length);
  buf.writeUInt32BE(payload.length, 0);
  buf.writeUInt8(type, 4);
  payload.copy(buf, 5);
  return buf;
}
```

---

**Q: How do you convert a Node.js Buffer to a browser-compatible** `ArrayBuffer`**?**

```js
function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const buf = Buffer.from([1, 2, 3, 4]);
const ab = toArrayBuffer(buf);
console.log(ab instanceof ArrayBuffer); // true
```

> Skipping the `.slice()` is the classic bug — you'd get an 8KB ArrayBuffer with your data buried inside it.

---

### Performance / Architecture (Senior)

---

**Q: Why is** `allocUnsafe` **faster? What's the internal pool mechanism?**

Node.js maintains a pre-allocated **8KB memory pool**. Small buffer allocations (&lt; 4KB) pull from this pool by advancing a pointer — no system call, no `malloc`.

```
Pool (8KB ArrayBuffer):
[  used  |  used  |  ← ptr  |  available  ]
                     ↑
          allocUnsafe(100) advances ptr by 100
          returns a subarray view of those 100 bytes
          (old data still in there — "unsafe")
```

`alloc()` does the same, then calls `buf.fill(0)` — that memset is the only performance difference.

Buffers &gt;= 4KB bypass the pool and call `malloc` directly.

---

**Q: What's the relationship between** `Buffer` **and** `TypedArray`**?**

`Buffer` **extends** `Uint8Array`. It is a `Uint8Array` with extra Node.js-specific methods.

```js
const buf = Buffer.from([1, 2, 3]);
console.log(buf instanceof Uint8Array); // true
console.log(buf instanceof Buffer);     // true
```

`BufferUint8Array`EnvironmentNode.js onlyBrowser + NodeExtra methods`readUInt32BE`, `toString(enc)`, `copy`, etc.NonePool allocationYes (small bufs)No

They share the same underlying `ArrayBuffer`:

```js
const buf = Buffer.from([1, 2, 3, 4]);
const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

view[0] = 99;
console.log(buf[0]); // 99 — same memory
```

---

### Common Gotchas

QuestionThe Trap`buf1 == buf2` — does this compare content?No — reference comparison. Use `buf.equals()`Can a Buffer be resized?No — fixed size. Must create a new oneDoes `toString()` always work for binary data?No — use `hex` or `base64` as intermediate for binary round-tripsIs `Buffer.from(string)` zero-copy?No — always copiesWhat does `buf.fill(0)` do?Zeroes out the buffer — use to clear sensitive data from memory

---

## 5. V8 Memory Model

When Node.js starts, the OS gives V8 a large chunk of memory. V8 manages that chunk itself — this is the **V8 heap**.

```
OS Memory
└── Node.js Process
    ├── V8 Heap          ← V8 manages this for JS objects
    │   ├── New Space    (young generation — short-lived objects)
    │   ├── Old Space    (long-lived objects, survives GC)
    │   ├── Code Space   (compiled JS bytecode)
    │   ├── Large Object Space (objects > ~256KB)
    │   └── ...
    │
    ├── External Memory  ← Buffer data lives here (outside V8 heap)
    ├── Stack            ← function call frames, primitives
    └── Native/C++ libs
```

### What Lives on the V8 Heap

Every JS value you create:

```js
const name = "Alice";      // string → heap
const obj  = { x: 1 };    // object → heap
const arr  = [1, 2, 3];   // array → heap
function foo() {}          // function → heap
```

V8's **garbage collector** tracks all of this. When nothing references a value anymore, GC reclaims that memory.

### What Does NOT Live on the V8 Heap

```js
const buf = Buffer.alloc(1024);
//  ┌─────────────────┐         ┌──────────────────────┐
//  │  V8 Heap        │         │  External Memory      │
//  │  buf (object)   │──────►  │  [raw 1024 bytes]     │
//  │  (small JS obj) │         │  (C++ allocated)      │
//  └─────────────────┘         └──────────────────────┘
```

The **Buffer JS object** lives on the heap (small), but the **actual byte data** lives outside. When the object is GC'd, a C++ finalizer frees the external memory.

### Why This Matters

```js
// 100MB on the V8 heap — GC must scan and manage it
const str = "x".repeat(100 * 1024 * 1024);

// ~0 bytes on V8 heap, 100MB in external memory — GC ignores the bulk
const buf = Buffer.alloc(100 * 1024 * 1024);
```

```js
const mu = process.memoryUsage();
console.log(mu.heapUsed);   // V8 heap in use
console.log(mu.external);   // Buffer/TypedArray data outside heap
console.log(mu.rss);        // total process memory
```

---

## 6. Clusters in Node.js

### The Problem

Node.js is **single-threaded**. It runs on one CPU core. If your server has 8 cores, 7 are sitting idle.

The **Cluster module** solves this by spawning multiple Node.js processes — one per core — all sharing the same port.

### How It Works

One **primary process** forks multiple **worker processes**. The OS distributes incoming connections across workers.

```
                  ┌─────────────────┐
                  │  Primary Process │
                  │  (no app logic) │
                  └────────┬────────┘
                           │ fork() × N workers
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │  Worker 1   │  │  Worker 2   │  │  Worker 3   │
   │  (Express)  │  │  (Express)  │  │  (Express)  │
   └─────────────┘  └─────────────┘  └─────────────┘
          ▲                ▲                ▲
          └────────────────┴────────────────┘
                    port :3000
               (shared, OS distributes)
```

### Basic Example

```js
import cluster from 'cluster';
import os from 'os';
import express from 'express';

const NUM_WORKERS = os.availableParallelism();

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} running`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

} else {
  const app = express();

  app.get('/', (req, res) => {
    res.send(`Handled by worker ${process.pid}`);
  });

  app.listen(3000, () => {
    console.log(`Worker ${process.pid} listening on :3000`);
  });
}
```

### How Port Sharing Works

The **primary process** is the only one that actually binds the port. It then passes socket handles to workers via IPC.

```
Client → port 3000 → Primary (holds the socket)
                         │
                    distributes via IPC
                         │
              Worker 1 / Worker 2 / Worker 3
```

### Communication Between Primary and Workers

```js
if (cluster.isPrimary) {
  const worker = cluster.fork();

  worker.on('message', (msg) => {
    console.log(`Primary got: ${msg.type}`);
    for (const w of Object.values(cluster.workers)) {
      w.send({ type: 'broadcast', data: msg.data });
    }
  });

} else {
  process.send({ type: 'cache-update', data: { key: 'x', value: 1 } });

  process.on('message', (msg) => {
    if (msg.type === 'broadcast') updateLocalCache(msg.data);
  });
}
```

### Graceful Shutdown

```js
if (cluster.isPrimary) {
  process.on('SIGTERM', () => {
    for (const worker of Object.values(cluster.workers)) {
      worker.send({ type: 'shutdown' });
    }
  });

} else {
  process.on('message', (msg) => {
    if (msg.type === 'shutdown') {
      server.close(() => {
        console.log(`Worker ${process.pid} closed cleanly`);
        process.exit(0);
      });
    }
  });
}
```

### Zero-Downtime Rolling Restart

```js
if (cluster.isPrimary) {
  const workers = Object.values(cluster.workers);
  let i = 0;

  function restartNext() {
    if (i >= workers.length) return;
    const worker = workers[i++];
    worker.send({ type: 'shutdown' });
    worker.on('exit', () => {
      const newWorker = cluster.fork();
      newWorker.on('listening', restartNext);
    });
  }

  process.on('SIGUSR2', restartNext);
}
```

### Cluster vs Worker Threads

ClusterWorker ThreadsWhat it isMultiple **processes**Multiple **threads** in one processMemorySeparate — no sharingShared via `SharedArrayBuffer`IsolationFull — crash doesn't affect othersPartial — shared memoryBest forHTTP servers, I/O-bound workloadsCPU-intensive tasksCommunicationIPC (message passing)`SharedArrayBuffer` or messagesOverheadHigh (full process)Low (thread)

### Important Caveats

**1. No shared in-memory state**

Each worker is a separate process. In-memory caches, sessions, rate limiters are NOT shared. Use Redis for shared state.

**2. Sticky sessions**

If a user's session is stored in memory on Worker 1, their next request might go to Worker 2. Use an external session store (Redis) or sticky sessions.

**3. CPU-bound work still blocks a worker**

Cluster helps throughput, not individual request latency for CPU-heavy work.

---

## 7. Interview Q&A: Clusters

### Conceptual (Junior)

---

**Q: What is the Cluster module and why do we need it?**

The Cluster module lets you spawn multiple Node.js processes that all share the same server port. We need it because Node.js runs on a single thread — on a machine with 8 cores, a plain Node.js process uses only one.

```js
if (cluster.isPrimary) {
  for (let i = 0; i < os.availableParallelism(); i++) cluster.fork();
} else {
  startServer();
}
```

---

**Q: Node.js is single-threaded — how does Cluster achieve parallelism?**

Cluster uses **processes**, not threads. Each `cluster.fork()` creates a completely separate OS process with its own V8 instance, event loop, and memory heap. These run truly in parallel on separate CPU cores.

---

**Q: What is the difference between primary and worker?**

PrimaryWorkerRoleManagerRequest handlerRuns app logicNoYesOwns the socketYesNoCan fork workersYesShould not

---

**Q: How many workers should you spawn?**

One worker per logical CPU core:

```js
const workers = os.availableParallelism(); // Node 18+ — respects container CPU limits
```

`availableParallelism()` is preferred over `os.cpus().length` in containers as it respects CPU quotas.

---

**Q: What happens when a worker process crashes?**

The primary gets an `exit` event. Without a handler, capacity drops permanently. The `exitedAfterDisconnect` flag distinguishes crashes from intentional shutdowns:

```js
cluster.on('exit', (worker) => {
  if (!worker.exitedAfterDisconnect) {
    console.log('Unexpected crash — restarting');
    cluster.fork();
  }
});
```

---

### Behavioral / Tricky (Mid-level)

---

**Q: You have a rate limiter in a Map. You cluster across 4 workers. Does it work?**

**No.** Each worker has its own memory. 100 requests distributed across 4 workers means each worker sees only 25 — the limit is never hit.

**Fix:** Use Redis with `rate-limiter-flexible`:

```js
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  points: 100,
  duration: 60,
});
```

---

**Q: Session stored on Worker 1, next request hits Worker 2. What happens?**

Session is lost — Worker 2 has no knowledge of it. Fix with an external session store:

```js
app.use(session({
  store: new RedisStore({ client: redis }),
  secret: 'secret',
}));
```

---

**Q: What is IPC in the context of clusters?**

IPC (Inter-Process Communication) is the channel Node sets up automatically between the primary and each worker. Since workers are separate processes, they can't share memory — IPC is how they communicate.

```js
worker.send({ type: 'config-update', data: { timeout: 5000 } }); // primary → worker
process.send({ type: 'metrics', requestCount: 150 });             // worker → primary
```

---

**Q: What is** `cluster.schedulingPolicy`**?**

Controls how the primary distributes connections to workers.

- `SCHED_RR` — Round Robin (default on Linux/Mac). Fair distribution.
- `SCHED_NONE` — Delegates to OS. Can pile connections onto fewer workers.

Almost always use the default `SCHED_RR`.

---

**Q: What is the difference between** `worker.kill()` **and** `worker.disconnect()`**?**

- `worker.disconnect()` — graceful. Closes IPC, stops accepting new connections, waits for in-flight requests to finish.
- `worker.kill(signal)` — forceful. Sends a signal. Worker dies immediately, in-flight requests are dropped.

Production pattern:

```js
worker.disconnect();
setTimeout(() => {
  if (!worker.isDead()) worker.kill('SIGKILL');
}, 5000);
```

---

### Practical / Coding (Mid-Senior)

---

**Q: How do you prevent a restart storm?**

```js
// BAD — crashes immediately on startup → infinite loop
cluster.on('exit', () => cluster.fork());

// GOOD — exponential backoff
const restartDelays = new Map();

cluster.on('exit', (worker) => {
  if (worker.exitedAfterDisconnect) return;

  const prev = restartDelays.get(worker.id) ?? 0;
  const delay = Math.min(prev * 2 || 100, 30_000); // cap at 30s
  restartDelays.set(worker.id, delay);

  setTimeout(() => {
    const newWorker = cluster.fork();
    newWorker.on('listening', () => restartDelays.delete(newWorker.id));
  }, delay);
});
```

---

**Q: How do you implement worker health checks?**

```js
// Worker — heartbeat every 5s
setInterval(() => {
  process.send({
    type: 'heartbeat',
    data: { pid: process.pid, memory: process.memoryUsage().heapUsed }
  });
}, 5000);

// Primary — detect unresponsive workers
const workerHealth = new Map();
worker.on('message', (msg) => {
  if (msg.type === 'heartbeat') {
    workerHealth.set(worker.id, { ...msg.data, lastSeen: Date.now() });
  }
});

setInterval(() => {
  for (const [id, health] of workerHealth) {
    if (Date.now() - health.lastSeen > 15_000) {
      cluster.workers[id]?.kill(); // unresponsive
    }
    if (health.memory > 512 * 1024 * 1024) {
      cluster.workers[id]?.disconnect(); // memory leak
    }
  }
}, 10_000);
```

---

### Architecture / Senior

---

**Q: Cluster vs Worker Threads — when to use each? Can you combine them?**

- **Cluster** — scale HTTP servers, process isolation, maximize multi-core throughput for I/O workloads
- **Worker Threads** — CPU-intensive tasks (image processing, encryption, ML inference)

Using both together:

```js
// Each cluster worker uses a thread pool for CPU tasks
const threadPool = new StaticPool({ size: 4, task: './cpu-intensive.js' });

app.post('/process', async (req, res) => {
  const result = await threadPool.exec(req.body); // event loop stays free
  res.json(result);
});
```

Pattern: **Cluster for horizontal I/O scaling × Worker Threads for vertical CPU scaling**.

---

**Q: In-memory pub/sub breaks after clustering. How do you fix it?**

Workers are separate processes — `EventEmitter` events don't cross process boundaries.

**Fix with Redis Pub/Sub:**

```js
const pub = createClient();
const sub = createClient();

// Any worker publishes
pub.publish('user:updated', JSON.stringify(data));

// All workers receive
sub.subscribe('user:updated', (message) => {
  localEmitter.emit('user:updated', JSON.parse(message));
});
```

---

**Q: WebSocket server clustered across 4 workers. Client A (Worker 1) needs to message Client B (Worker 3). How?**

WebSocket connections are stateful — the socket lives in one worker. Use Redis Pub/Sub as a message bus:

```js
wss.on('connection', (socket, req) => {
  const clientId = req.headers['x-client-id'];
  clients.set(clientId, socket);

  socket.on('message', (rawMsg) => {
    const { to, content } = JSON.parse(rawMsg);
    pub.publish('ws:message', JSON.stringify({ to, content }));
  });
});

// Every worker subscribes — delivers if it holds the target socket
sub.subscribe('ws:message', (raw) => {
  const { to, content } = JSON.parse(raw);
  const socket = clients.get(to);
  if (socket?.readyState === WebSocket.OPEN) socket.send(content);
});
```

---

**Q: Cluster vs multiple processes behind Nginx — tradeoffs?**

Node ClusterNginx + Multiple ProcessesLoad balancingRound-robin via primaryNginx (least-conn, ip-hash, etc.)Cross-machine scalingNo — single machine onlyYesComplexityLowerHigherHealth checksManual IPCNginx active health checks built-inSSL terminationManualNginx handles natively

In practice: **Cluster + PM2 for process management, Nginx in front for SSL/routing/static files**.

---

**Q: Should the primary process handle HTTP requests?**

**No.**

1. Primary crash = all workers die (no more restarts)
2. Primary is single-threaded — handling requests blocks lifecycle management
3. No clean way to reload primary without downtime

```js
// BAD
if (cluster.isPrimary) {
  cluster.fork();
  app.listen(3000); // don't do this
}

// GOOD
if (cluster.isPrimary) {
  cluster.fork(); // only manage workers
} else {
  app.listen(3000); // only workers serve traffic
}
```

---

### Common Gotchas

QuestionThe TrapDoes clustering improve response time for a single CPU-heavy request?No — improves **throughput**, not individual latencyDo workers share memory?No — separate processes, separate heapsIf you `require` the same module in all workers, loaded once or N times?N times — each process has its own module cacheCan a worker `fork()` more workers?Technically yes, but only the primary should forkAfter a worker exits, does `cluster.workers` still contain it?No — removed after the `exit` event fires

---

*Generated from a Node.js internals study session — covers AsyncLocalStorage, Buffers, V8 memory model, and Clusters with real-world patterns and interview preparation.*
