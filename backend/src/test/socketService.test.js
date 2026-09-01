process.env.JWT_ACCESS_SECRET ||= "test-access-secret";

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

let registerSocketHandlers;
let jwt;

beforeAll(async () => {
  ({ registerSocketHandlers } = await import("../services/socketService.js"));
  jwt = (await import("jsonwebtoken")).default;
});

function createFakeIo() {
  const middleware = [];
  const connectionHandlers = [];
  return {
    use(fn) {
      middleware.push(fn);
    },
    on(event, fn) {
      if (event === "connection") connectionHandlers.push(fn);
    },
    middleware,
    connectionHandlers,
  };
}

function createFakeSocket() {
  return {
    handshake: {},
    data: {},
    emitted: [],
    emit(event, payload) {
      this.emitted.push([event, payload]);
    },
    join: jest.fn(async () => {}),
    listeners: {},
    on(event, fn) {
      this.listeners[event] = fn;
    },
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
}

function runAuthMiddleware(io, socket) {
  const next = jest.fn();
  for (const middleware of io.middleware) middleware(socket, next);
  return next;
}

function connectAs(user, handshakeToken) {
  const io = createFakeIo();
  registerSocketHandlers(io);
  const socket = createFakeSocket();

  if (handshakeToken !== undefined) {
    socket.handshake.auth = { token: handshakeToken };
  }
  if (user !== undefined) {
    socket.data.user = user;
  }

  const next = runAuthMiddleware(io, socket);
  for (const handler of io.connectionHandlers) handler(socket);

  return { socket, next };
}

describe("socketService authorization", () => {
  afterAll(() => {
    delete global.prisma;
  });

  it("rejects connections without a token", () => {
    const { next } = connectAs(undefined, undefined);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("Unauthorized");
  });

  it("rejects invalid tokens", () => {
    const { next } = connectAs(undefined, "not-a-jwt");
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("Unauthorized");
  });

  it("accepts valid access tokens and attaches the identity", () => {
    const token = signToken({ userId: "user_1", role: "MEMBER" });
    const { socket, next } = connectAs(undefined, token);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ userId: "user_1", role: "MEMBER" });
  });

  it("allows a customer to join only their own room", async () => {
    const { socket } = connectAs({ userId: "user_1", role: "MEMBER" });

    await socket.listeners["customer:join"]("user_1");
    expect(socket.join).toHaveBeenCalledWith("customer:user_1");
    expect(socket.emitted.at(-1)[0]).toBe("connection:success");

    await socket.listeners["customer:join"]("user_2");
    expect(socket.join).not.toHaveBeenCalledWith("customer:user_2");
    expect(socket.emitted.at(-1)[0]).toBe("connection:error");
  });

  it("allows vendors to join only their own vendor room", async () => {
    global.prisma = {
      Vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: "vendor_owned" }),
      },
    };
    const { socket } = connectAs({ userId: "vendor_user_1", role: "VENDOR" });

    await socket.listeners["vendor:join"]("vendor_owned");
    expect(global.prisma.Vendor.findUnique).toHaveBeenCalledWith({
      where: { userId: "vendor_user_1" },
      select: { id: true },
    });
    expect(socket.join).toHaveBeenCalledWith("vendor:vendor_owned");

    await socket.listeners["vendor:join"]("vendor_other");
    expect(socket.join).not.toHaveBeenCalledWith("vendor:vendor_other");
    expect(socket.emitted.at(-1)[0]).toBe("connection:error");
  });

  it("rejects non-vendor roles from vendor rooms without a lookup", async () => {
    global.prisma = {
      Vendor: { findUnique: jest.fn() },
    };
    const { socket } = connectAs({ userId: "user_1", role: "MEMBER" });

    await socket.listeners["vendor:join"]("vendor_1");
    expect(global.prisma.Vendor.findUnique).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emitted.at(-1)[0]).toBe("connection:error");
  });
});
