const userNeedInput = document.querySelector("#userNeed");
const targetCustomerInput = document.querySelector("#targetCustomer");
const productPointsInput = document.querySelector("#productPoints");
const industrySelect = document.querySelector("#industrySelect");
const customIndustryInput = document.querySelector("#customIndustryInput");
const styleSelect = document.querySelector("#styleSelect");
const generateBtn = document.querySelector("#generateBtn");
const regenerateBtn = document.querySelector("#regenerateBtn");
const copyAllBtn = document.querySelector("#copyAllBtn");
const exportTxtBtn = document.querySelector("#exportTxtBtn");
const exampleBtn = document.querySelector("#exampleBtn");
const clearBtn = document.querySelector("#clearBtn");
const copyButtons = document.querySelectorAll(".copy-btn");
const statusMessage = document.querySelector("#statusMessage");
const generationTime = document.querySelector("#generationTime");
const generateWeeklyBtn = document.querySelector("#generateWeeklyBtn");
const copyWeeklyBtn = document.querySelector("#copyWeeklyBtn");
const exportWeeklyBtn = document.querySelector("#exportWeeklyBtn");
const weeklyStatusMessage = document.querySelector("#weeklyStatusMessage");
const weeklyPlanCards = document.querySelector("#weeklyPlanCards");

const apiUrl = "http://localhost:3000/api/generate";
const weeklyApiUrl = "http://localhost:3000/api/generate-weekly-plan";

const defaultCopies = {
  wechatCopy: "输入需求后，生成适合朋友圈发布的自然文案。",
  douyinCopy: "输入需求后，生成适合短视频口播和标题的文案。",
  xiaohongshuCopy: "输入需求后，生成适合分享体验和种草的文案。",
  chatCopy: "输入需求后，生成适合私聊客户的成交话术。",
};

const copyTargets = {
  wechatCopy: document.querySelector("#wechatCopy"),
  douyinCopy: document.querySelector("#douyinCopy"),
  xiaohongshuCopy: document.querySelector("#xiaohongshuCopy"),
  chatCopy: document.querySelector("#chatCopy"),
};

const copyTitles = {
  wechatCopy: "微信朋友圈文案",
  douyinCopy: "抖音短视频文案",
  xiaohongshuCopy: "小红书种草文案",
  chatCopy: "私聊客户成交话术",
};

let hasGenerated = false;
let lastGeneratedData = null;
let weeklyPlan = [];
let lastWeeklyData = null;

const errorMessages = {
  missing_api_key: "请先配置 OpenAI API Key。",
  invalid_api_key: "请检查 OpenAI API Key 是否正确。",
  account_or_permission: "请检查 OpenAI API 账户余额或模型权限。",
  service_unavailable: "AI 服务暂时不可用，请稍后重试。",
  network_error: "网络或服务异常：AI 服务暂时不可用，请稍后重试。",
  invalid_request: "请完整填写行业、文案风格、需求、目标客户和产品卖点。",
};

function cleanText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function isCustomIndustrySelected() {
  return industrySelect.value === "自定义行业";
}

function getSelectedIndustry() {
  if (isCustomIndustrySelected()) {
    return cleanText(customIndustryInput.value);
  }

  return industrySelect.value;
}

function updateCustomIndustryVisibility() {
  const shouldShow = isCustomIndustrySelected();
  customIndustryInput.classList.toggle("show", shouldShow);

  if (!shouldShow) {
    customIndustryInput.value = "";
  }
}

function getFormData() {
  return {
    need: cleanText(userNeedInput.value),
    customer: cleanText(targetCustomerInput.value),
    points: cleanText(productPointsInput.value),
    industry: getSelectedIndustry(),
    style: styleSelect.value,
  };
}

function validateForm(data) {
  if (isCustomIndustrySelected() && !data.industry) {
    alert("请填写自定义行业。");
    customIndustryInput.focus();
    return false;
  }

  if (!data.need) {
    alert("请先输入你的推广需求，例如：我要卖水果");
    userNeedInput.focus();
    return false;
  }

  if (!data.customer) {
    alert("请填写目标客户，例如：宝妈、本地顾客、游戏玩家");
    targetCustomerInput.focus();
    return false;
  }

  if (!data.points) {
    alert("请填写产品卖点，例如：价格便宜、效果好、速度快");
    productPointsInput.focus();
    return false;
  }

  return true;
}

function showCopies(copies) {
  copyTargets.wechatCopy.textContent = copies.wechat;
  copyTargets.douyinCopy.textContent = copies.douyin;
  copyTargets.xiaohongshuCopy.textContent = copies.xiaohongshu;
  copyTargets.chatCopy.textContent = copies.sales;

  document.querySelectorAll(".copy-card").forEach((card) => {
    card.classList.add("generated");
  });
}

function clearStatus() {
  statusMessage.textContent = "";
  statusMessage.className = "status-message";
  generationTime.textContent = "";
  generationTime.className = "generation-time";
}

function showStatus(type, message) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;
}

function showGenerationTime(seconds) {
  generationTime.textContent = `本次生成耗时：${seconds} 秒`;
  generationTime.className = "generation-time show";
}

function clearWeeklyStatus() {
  weeklyStatusMessage.textContent = "";
  weeklyStatusMessage.className = "status-message";
}

function showWeeklyStatus(type, message) {
  weeklyStatusMessage.textContent = message;
  weeklyStatusMessage.className = `status-message show ${type}`;
}

function setGeneratingState(isGenerating) {
  generateBtn.disabled = isGenerating;
  regenerateBtn.disabled = isGenerating;
  generateBtn.textContent = isGenerating ? "生成中，请稍等..." : "生成文案";
  regenerateBtn.textContent = isGenerating ? "生成中，请稍等..." : "重新生成";
}

function setWeeklyGeneratingState(isGenerating) {
  generateWeeklyBtn.disabled = isGenerating;
  copyWeeklyBtn.disabled = isGenerating;
  exportWeeklyBtn.disabled = isGenerating;
  generateWeeklyBtn.textContent = isGenerating ? "7 天内容生成中，请稍等..." : "生成 7 天朋友圈内容";
}

async function requestCopies(data) {
  let response;

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        industry: data.industry,
        style: data.style,
        need: data.need,
        customer: data.customer,
        points: data.points,
      }),
    });
  } catch {
    throw new Error(errorMessages.network_error);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(errorMessages[result.error] || result.message || errorMessages.service_unavailable);
  }

  return result;
}

async function requestWeeklyPlan(data) {
  let response;

  try {
    response = await fetch(weeklyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        industry: data.industry,
        style: data.style,
        need: data.need,
        customer: data.customer,
        points: data.points,
      }),
    });
  } catch {
    throw new Error(errorMessages.network_error);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(errorMessages[result.error] || result.message || errorMessages.service_unavailable);
  }

  return result.plan || [];
}

async function generateCopies() {
  const data = getFormData();

  if (!validateForm(data)) {
    return;
  }

  setGeneratingState(true);
  clearStatus();
  const startTime = performance.now();

  try {
    const copies = await requestCopies(data);
    showCopies(copies);
    lastGeneratedData = data;
    hasGenerated = true;
    const seconds = ((performance.now() - startTime) / 1000).toFixed(1);
    showStatus("success", "文案生成成功，已为你生成 4 类内容。");
    showGenerationTime(seconds);
  } catch (error) {
    showStatus("error", error.message || errorMessages.service_unavailable);
  } finally {
    setGeneratingState(false);
  }
}

function renderWeeklyPlan(plan) {
  weeklyPlanCards.innerHTML = "";

  plan.forEach((item) => {
    const card = document.createElement("article");
    card.className = "weekly-day-card";

    const top = document.createElement("div");
    top.className = "weekly-day-top";

    const day = document.createElement("span");
    day.textContent = `第 ${item.day} 天`;

    const theme = document.createElement("strong");
    theme.textContent = item.theme;

    top.append(day, theme);

    const title = document.createElement("h3");
    title.textContent = item.title;

    const content = document.createElement("p");
    content.textContent = item.content;

    const meta = document.createElement("div");
    meta.className = "weekly-meta";

    const image = document.createElement("p");
    image.innerHTML = "<strong>配图建议：</strong>";
    image.append(document.createTextNode(item.imageSuggestion));

    const time = document.createElement("p");
    time.innerHTML = "<strong>适合发布时间：</strong>";
    time.append(document.createTextNode(item.publishTime));

    const purpose = document.createElement("p");
    purpose.innerHTML = "<strong>运营目的：</strong>";
    purpose.append(document.createTextNode(item.purpose));

    meta.append(image, time, purpose);
    card.append(top, title, content, meta);
    weeklyPlanCards.appendChild(card);
  });
}

async function generateWeeklyPlan() {
  const data = getFormData();

  if (!validateForm(data)) {
    return;
  }

  setWeeklyGeneratingState(true);
  clearWeeklyStatus();

  try {
    const plan = await requestWeeklyPlan(data);
    weeklyPlan = plan;
    lastWeeklyData = data;
    renderWeeklyPlan(plan);
    showWeeklyStatus("success", "7 天朋友圈内容已生成。");
  } catch (error) {
    showWeeklyStatus("error", error.message || errorMessages.service_unavailable);
  } finally {
    setWeeklyGeneratingState(false);
  }
}

function clearCopyButtonStates() {
  copyButtons.forEach((button) => {
    button.textContent = "一键复制";
    button.classList.remove("copied");
  });

  copyAllBtn.textContent = "复制全部文案";
  copyAllBtn.classList.remove("copied");

  exportTxtBtn.textContent = "导出 TXT";
  exportTxtBtn.classList.remove("exported");

  copyWeeklyBtn.textContent = "复制 7 天内容";
  copyWeeklyBtn.classList.remove("copied");

  exportWeeklyBtn.textContent = "导出 7 天内容 TXT";
  exportWeeklyBtn.classList.remove("exported");
}

function resetWeeklyPlan() {
  weeklyPlan = [];
  lastWeeklyData = null;
  weeklyPlanCards.innerHTML = '<p class="weekly-empty">填写上方信息后，点击“生成 7 天朋友圈内容”，这里会展示每天的朋友圈标题、正文、配图建议和发布时间。</p>';
  clearWeeklyStatus();
}

function clearContent() {
  userNeedInput.value = "";
  targetCustomerInput.value = "";
  productPointsInput.value = "";
  industrySelect.selectedIndex = 0;
  customIndustryInput.value = "";
  updateCustomIndustryVisibility();
  styleSelect.selectedIndex = 0;
  hasGenerated = false;
  lastGeneratedData = null;

  Object.entries(defaultCopies).forEach(([id, text]) => {
    copyTargets[id].textContent = text;
  });

  document.querySelectorAll(".copy-card").forEach((card) => {
    card.classList.remove("generated");
  });

  clearCopyButtonStates();
  clearStatus();
  resetWeeklyPlan();
  userNeedInput.focus();
}

function fillExample() {
  industrySelect.value = "加速器/网络工具";
  customIndustryInput.value = "";
  updateCustomIndustryVisibility();
  styleSelect.value = "朋友圈真实口吻";
  userNeedInput.value = "我要推广一个稳定好用的网络工具";
  targetCustomerInput.value = "经常玩游戏和需要海外工具的人";
  productPointsInput.value = "稳定、速度快、售后及时";
  clearCopyButtonStates();
  clearStatus();
  resetWeeklyPlan();
  userNeedInput.focus();
}

function formatDateTimeForFileName(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getExportText() {
  const data = lastGeneratedData || getFormData();

  return [
    "AI 私域文案生成器",
    "",
    `行业：${data.industry}`,
    `文案风格：${data.style}`,
    `需求：${data.need}`,
    `目标客户：${data.customer}`,
    `产品卖点：${data.points}`,
    "",
    `微信朋友圈文案：\n${copyTargets.wechatCopy.textContent}`,
    "",
    `抖音短视频文案：\n${copyTargets.douyinCopy.textContent}`,
    "",
    `小红书种草文案：\n${copyTargets.xiaohongshuCopy.textContent}`,
    "",
    `私聊成交话术：\n${copyTargets.chatCopy.textContent}`,
  ].join("\n");
}

function exportTxt() {
  if (!hasGenerated) {
    alert("请先生成文案。");
    return;
  }

  const blob = new Blob([getExportText()], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ai-copywriter-${formatDateTimeForFileName(new Date())}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  exportTxtBtn.textContent = "已导出";
  exportTxtBtn.classList.add("exported");

  setTimeout(() => {
    exportTxtBtn.textContent = "导出 TXT";
    exportTxtBtn.classList.remove("exported");
  }, 1400);
}

function getAllCopyText() {
  return Object.entries(copyTargets)
    .map(([id, element]) => `${copyTitles[id]}\n${element.textContent}`)
    .join("\n\n");
}

function getWeeklyPlanText() {
  const data = lastWeeklyData || getFormData();
  const content = weeklyPlan.map((item) => [
    `第 ${item.day} 天：${item.theme}`,
    `朋友圈标题：${item.title}`,
    `正文内容：${item.content}`,
    `配图建议：${item.imageSuggestion}`,
    `适合发布时间：${item.publishTime}`,
    `运营目的：${item.purpose}`,
  ].join("\n")).join("\n\n");

  return [
    "7 天朋友圈内容计划",
    "",
    `行业：${data.industry}`,
    `文案风格：${data.style}`,
    `需求：${data.need}`,
    `目标客户：${data.customer}`,
    `产品卖点：${data.points}`,
    "",
    content,
  ].join("\n");
}

async function writeClipboard(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function showCopiedState(button, label) {
  button.textContent = "已复制";
  button.classList.add("copied");

  setTimeout(() => {
    button.textContent = label;
    button.classList.remove("copied");
  }, 1400);
}

async function copyText(button) {
  const targetId = button.dataset.copyTarget;
  const text = copyTargets[targetId].textContent;

  try {
    await writeClipboard(text);
    showCopiedState(button, "一键复制");
  } catch (error) {
    alert("复制失败，请手动选中文案复制。");
  }
}

async function copyAllText() {
  try {
    await writeClipboard(getAllCopyText());
    showCopiedState(copyAllBtn, "复制全部文案");
  } catch (error) {
    alert("复制失败，请手动选中文案复制。");
  }
}

async function copyWeeklyPlan() {
  if (weeklyPlan.length === 0) {
    showWeeklyStatus("error", "请先生成 7 天朋友圈内容。");
    return;
  }

  try {
    await writeClipboard(getWeeklyPlanText());
    showCopiedState(copyWeeklyBtn, "复制 7 天内容");
  } catch (error) {
    showWeeklyStatus("error", "复制失败，请手动选中 7 天内容复制。");
  }
}

function exportWeeklyPlan() {
  if (weeklyPlan.length === 0) {
    showWeeklyStatus("error", "请先生成 7 天朋友圈内容。");
    return;
  }

  const blob = new Blob([getWeeklyPlanText()], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `ai-copywriter-weekly-${formatDateTimeForFileName(new Date())}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  exportWeeklyBtn.textContent = "已导出";
  exportWeeklyBtn.classList.add("exported");

  setTimeout(() => {
    exportWeeklyBtn.textContent = "导出 7 天内容 TXT";
    exportWeeklyBtn.classList.remove("exported");
  }, 1400);
}

generateBtn.addEventListener("click", generateCopies);
regenerateBtn.addEventListener("click", generateCopies);
copyAllBtn.addEventListener("click", copyAllText);
exportTxtBtn.addEventListener("click", exportTxt);
exampleBtn.addEventListener("click", fillExample);
clearBtn.addEventListener("click", clearContent);
generateWeeklyBtn.addEventListener("click", generateWeeklyPlan);
copyWeeklyBtn.addEventListener("click", copyWeeklyPlan);
exportWeeklyBtn.addEventListener("click", exportWeeklyPlan);
industrySelect.addEventListener("change", updateCustomIndustryVisibility);

copyButtons.forEach((button) => {
  button.addEventListener("click", () => copyText(button));
});

userNeedInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    generateCopies();
  }
});

updateCustomIndustryVisibility();
