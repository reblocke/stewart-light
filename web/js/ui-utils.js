export function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Not provided";
  }
  return Number(value).toFixed(digits);
}

export function formatSigned(value) {
  const numericValue = Number(value);
  if (Math.abs(numericValue) < 0.05) {
    return "0.0";
  }
  return `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(1)}`;
}

export function dataNumber(value) {
  return Number(value).toFixed(1);
}

export function renderMessages(container, messages) {
  container.replaceChildren();
  if (messages.length === 0) {
    container.hidden = true;
    return;
  }

  const list = document.createElement("ul");
  for (const message of messages) {
    const item = document.createElement("li");
    item.textContent = typeof message === "string" ? message : message.message;
    list.append(item);
  }
  container.append(list);
  container.hidden = false;
}

export function renderDefinitionList(container, rows) {
  container.replaceChildren();
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    container.append(term, description);
  }
}

export function renderList(container, items) {
  container.replaceChildren();
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    container.append(li);
  }
}

export function setRuntimeStatus(runtimeStatus, message, stateName) {
  runtimeStatus.textContent = message;
  runtimeStatus.dataset.state = stateName;
}
