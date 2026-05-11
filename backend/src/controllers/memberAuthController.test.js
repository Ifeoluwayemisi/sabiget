jest.mock("../services/memberAuthService", () => ({
  createMemberAccountService: jest.fn(),
  loginService: jest.fn(),
}));

const {
  createMemberAccountService,
  loginService,
} = require("../services/memberAuthService");
const memberAuthController = require("./memberAuthController");

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("memberAuthController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires an authenticated user for account creation", async () => {
    const req = {
      body: { password: "securePass123" },
      user: undefined,
    };
    const res = createRes();

    await memberAuthController.createAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authenticated user is required",
    });
    expect(createMemberAccountService).not.toHaveBeenCalled();
  });

  it("rejects invalid email format during account creation", async () => {
    const req = {
      body: { password: "securePass123", email: "not-an-email" },
      user: { userId: "user_1" },
    };
    const res = createRes();

    await memberAuthController.createAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid email format",
    });
  });

  it("returns tokens when authenticated guest upgrade succeeds", async () => {
    createMemberAccountService.mockResolvedValue({
      success: true,
      message: "Account created successfully",
      user: { id: "user_2", role: "MEMBER" },
      tokens: {
        accessToken: "access_token",
        refreshToken: "refresh_token",
      },
    });

    const req = {
      body: { password: "securePass123", name: "Ada" },
      user: { userId: "user_2" },
    };
    const res = createRes();

    await memberAuthController.createAccount(req, res);

    expect(createMemberAccountService).toHaveBeenCalledWith({
      userId: "user_2",
      password: "securePass123",
      name: "Ada",
      email: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects invalid phone format for member login", async () => {
    const req = {
      body: { phone: "123", password: "securePass123" },
    };
    const res = createRes();

    await memberAuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid Nigerian phone number",
      example: "+2348123456789",
    });
    expect(loginService).not.toHaveBeenCalled();
  });

  it("returns member tokens on successful login", async () => {
    loginService.mockResolvedValue({
      success: true,
      message: "Login successful",
      user: { id: "user_3", role: "MEMBER" },
      tokens: {
        accessToken: "member_access",
        refreshToken: "member_refresh",
      },
    });

    const req = {
      body: { phone: "+2348123456789", password: "securePass123" },
    };
    const res = createRes();

    await memberAuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Login successful",
      user: { id: "user_3", role: "MEMBER" },
      accessToken: "member_access",
      refreshToken: "member_refresh",
      expiresIn: "15 minutes",
      refreshExpiresIn: "7 days",
    });
  });
});
