function extractStatus(message = "") {
  const match = String(message || "").match(/(\d{3})/);
  return match ? Number(match[1]) : 0;
}

export function isLikelyAbortError(error) {
  const queue = [error];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const message = String(current?.message || "").trim();
    if (current?.name === "AbortError" || /signal is aborted without reason|The user aborted a request/i.test(message)) {
      return true;
    }
    if (current?.cause && current.cause !== current) {
      queue.push(current.cause);
    }
  }
  return false;
}

export function isLikelyNetworkError(error) {
  const queue = [error];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const message = String(current?.message || "").trim();
    if (current?.isNetworkLike || isLikelyAbortError(current) || /Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return true;
    }
    if (current?.cause && current.cause !== current) {
      queue.push(current.cause);
    }
  }
  return false;
}

function formatValidationDetails(details) {
  const fieldErrors = details?.fieldErrors || {};
  const hints = [];

  if (fieldErrors.username?.length) {
    hints.push("用户名需为 3-64 位且不能包含空格");
  }
  if (fieldErrors.password?.length || fieldErrors.newPassword?.length || fieldErrors.currentPassword?.length) {
    hints.push("密码需为 6-128 位");
  }
  if (fieldErrors.recoveryCode?.length) {
    hints.push("恢复码格式不正确");
  }
  if (fieldErrors.captchaText?.length) {
    hints.push("验证码格式不正确");
  }
  if (fieldErrors.url?.length) {
    hints.push("链接格式不正确");
  }
  if (fieldErrors.name?.length) {
    hints.push("名称填写不完整");
  }

  return hints.length ? hints.join("；") : "";
}

function mapStatusToMessage(status, fallback) {
  if (status === 400) {
    return fallback || "提交的信息有误，请检查后重试。";
  }
  if (status === 401) {
    return "登录已失效，或账号认证失败，请重新登录。";
  }
  if (status === 403) {
    return "当前操作暂不可用，请稍后重试。";
  }
  if (status === 404) {
    return "请求的服务不存在，可能仍在部署或地址不正确。";
  }
  if (status === 409) {
    return "数据状态已变化，请刷新后重试。";
  }
  if (status === 429) {
    return "请求过于频繁，请稍后再试。";
  }
  if (status >= 500) {
    return "服务暂时不可用，请稍后重试。";
  }
  return fallback || "操作失败，请稍后重试。";
}

export function getUserFacingErrorMessage(error, fallback = "操作失败，请稍后重试。") {
  if (!error) {
    return fallback;
  }

  const message = String(error?.message || "").trim();
  const status = Number(error?.status || extractStatus(message) || 0);

  if (isLikelyAbortError(error)) {
    return "请求超时，服务可能仍在启动，请稍后重试。";
  }

  if (isLikelyNetworkError(error)) {
    return "无法连接到服务，请检查网络或稍后重试。";
  }

  if (error instanceof SyntaxError) {
    if (error?.serverResponse) {
      return "服务返回了无法解析的数据，请稍后重试。";
    }
    return "数据格式不正确，请检查文件内容后重试。";
  }

  if (message === "No stock resolved") {
    return "暂时无法识别股票代码，请检查组件设置。";
  }

  if (message === "Turnstile widget mount point is not ready") {
    return "安全验证组件尚未准备好，请刷新页面后重试。";
  }

  if (message.includes("Validation failed")) {
    const detailsHint = formatValidationDetails(error?.details || {});
    return detailsHint || "提交的信息格式不正确，请检查后重试。";
  }

  if (/^Request failed: \d{3}$/.test(message) || /^Healthcheck failed: \d{3}$/.test(message)) {
    return mapStatusToMessage(status, fallback);
  }

  if (message.includes("Cannot GET /api/auth/challenge")) {
    return "认证服务尚未更新完成，请稍后重试。";
  }

  if (message) {
    return message;
  }

  return mapStatusToMessage(status, fallback);
}
