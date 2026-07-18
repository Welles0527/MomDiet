import cloudbase from "@cloudbase/js-sdk";

const ENV_ID = "magicj-web-d5g9yvowj6862f7a2";
const SESSION_KEY = "mywebsite.site-auth-session.v1";
const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const app = cloudbase.init({ env: ENV_ID });
const auth = app.auth();
let sessionRevision = 0;

function readRememberedSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.uid || !parsed.account || typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function rememberSession(session) {
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...session, expiresAt: Date.now() + SESSION_TTL_MS }),
    );
  } catch {
    // CloudBase still owns the real login session when localStorage is unavailable.
  }
  sessionRevision += 1;
  window.dispatchEvent(new CustomEvent("site-auth-change", { detail: session }));
}

function forgetSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // There is nothing else to clear when localStorage is unavailable.
  }
  sessionRevision += 1;
  window.dispatchEvent(new CustomEvent("site-auth-change", { detail: null }));
}

function sessionFromCurrentUser(loginState) {
  const currentUser = loginState?.user ?? auth.currentUser;
  if (!currentUser?.uid) return null;
  return {
    uid: currentUser.uid,
    account: currentUser.email || currentUser.username || "我的账号",
  };
}

function assertCloudResult(result, fallback) {
  if (!result) throw new Error(fallback);
  if (result.error) throw new Error(result.error.message || fallback);
  return result.data;
}

export function getRememberedSession() {
  const remembered = readRememberedSession();
  if (!remembered) return null;
  if (remembered.expiresAt <= Date.now()) {
    forgetSession();
    return null;
  }
  return { uid: remembered.uid, account: remembered.account };
}

export async function getCloudSession() {
  const remembered = getRememberedSession();
  const revisionAtStart = sessionRevision;
  const loginState = await auth.getLoginState();
  const session = sessionFromCurrentUser(loginState);
  if (!session) {
    if (sessionRevision !== revisionAtStart) return getRememberedSession();
    if (remembered) forgetSession();
    return null;
  }

  if (!remembered || remembered.uid !== session.uid) {
    rememberSession(session);
  }
  return session;
}

export async function signInWithPassword(email, password) {
  const result = await auth.signInWithPassword({ email, password });
  const loginData = assertCloudResult(result, "登录失败。");
  const session = sessionFromCurrentUser({ user: loginData?.user }) || await getCloudSession();
  if (!session) throw new Error("登录成功，但未取得登录会话。请重试。");
  rememberSession(session);
  return session;
}

export async function startEmailSignUp(email, password) {
  const result = await auth.signUp({ email, password });
  const signUpData = assertCloudResult(result, "无法发送邮箱验证码。");
  if (!signUpData?.verifyOtp) throw new Error("无法发送邮箱验证码，请稍后重试。");

  return async (verificationCode) => {
    const verifyResult = await signUpData.verifyOtp({ token: verificationCode });
    const verificationData = assertCloudResult(verifyResult, "邮箱验证码无效或已过期。");
    const session = sessionFromCurrentUser({ user: verificationData?.user }) || await getCloudSession();
    if (!session) throw new Error("验证成功，但未取得登录会话。请重新登录。");
    rememberSession(session);
    return session;
  };
}
