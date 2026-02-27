const CSV_SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRMpK2oJSiJb4_JUHEXu1ThT4U33ByWK46jZNR8isA5KSLDY3BkM_p1UTf_LF6BKBfQbHrTVPNCg31q/pub?output=csv";

const dom = {
  year: document.getElementById("van-year"),
  make: document.getElementById("van-make"),
  model: document.getElementById("van-model"),
  vanType: document.getElementById("van-type"),
  laborRate: document.getElementById("labor-rate"),
  taxRate: document.getElementById("tax-rate"),
  sections: document.getElementById("sections-container"),
  status: document.getElementById("source-status"),
  estimateMeta: document.getElementById("estimate-meta"),
  overallMaterial: document.getElementById("overall-material"),
  overallLabor: document.getElementById("overall-labor"),
  overallPreTax: document.getElementById("overall-pre-tax"),
  overallTax: document.getElementById("overall-tax"),
  overallTotal: document.getElementById("overall-total"),
  printButton: document.getElementById("print-button"),
};

const state = {
  catalog: null,
  selectedBySection: {},
  collapsedBySection: {},
  estimate: {
    year: "",
    make: "",
    model: "",
    vanType: "",
    laborRate: 110,
    taxRate: 8.25,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const makeId = (sectionName, rowIndex) =>
  `${sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${rowIndex}`;

const sectionKey = (sectionName) =>
  sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const normalize = (value) => String(value || "").trim().toLowerCase();

const asNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const clean = value.replace(/[$,%\s,]/g, "");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const yesValue = (value) => {
  if (typeof value === "number") {
    return value > 0;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return ["x", "yes", "y", "true", "1", "compatible"].includes(normalized);
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
};

const pickColumn = (headers, candidates) => {
  const normalizedHeaders = headers.map((header) => normalize(header));
  return normalizedHeaders.findIndex((header) =>
    candidates.some((candidate) => header.includes(candidate))
  );
};

const labelForVanType = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "Unknown";
  }
  return text[0].toUpperCase() + text.slice(1);
};

const loadCatalog = async () => {
  const response = await fetch(CSV_SOURCE_URL);
  if (!response.ok) {
    throw new Error(`CSV request failed with ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);
  if (!rows.length) {
    throw new Error("CSV source returned no rows");
  }

  const [headerRow, ...bodyRows] = rows;
  const headers = headerRow.map((header) => String(header || "").trim());

  const typeCol = pickColumn(headers, ["type", "types"]);
  const descriptionCol = pickColumn(headers, ["item description", "product", "item", "name"]);
  const linkCol = pickColumn(headers, ["link", "url"]);
  const sizeCol = pickColumn(headers, ["item size", "size"]);
  const priceCol = pickColumn(headers, ["price per unit", "price", "material cost"]);
  const estHoursCol = pickColumn(headers, ["est.hrs", "est hrs", "estimated hours", "labor hours", "hours"]);

  if (typeCol < 0 || descriptionCol < 0) {
    throw new Error("CSV is missing required Type and Item Description columns");
  }

  const knownVanTypes = ["promaster", "sprinter", "transit", "other"];
  const compatibilityColumns = headers
    .map((header, index) => ({
      index,
      key: normalize(header),
    }))
    .filter(({ key }) => knownVanTypes.includes(key));

  const sectionsMap = new Map();

  bodyRows.forEach((row, rowIndex) => {
    const sectionName = String(row[typeCol] || "").trim();
    const itemDescription = String(row[descriptionCol] || "").trim();

    if (!sectionName || !itemDescription) {
      return;
    }

    const compatible = compatibilityColumns
      .filter(({ index }) => yesValue(row[index]))
      .map(({ key }) => key);

    const item = {
      id: makeId(sectionName, rowIndex),
      description: itemDescription,
      link: String(linkCol >= 0 ? row[linkCol] || "" : "").trim(),
      itemSize: String(sizeCol >= 0 ? row[sizeCol] || "" : "").trim(),
      pricePerUnit: asNumber(priceCol >= 0 ? row[priceCol] : 0),
      estimatedHours: asNumber(estHoursCol >= 0 ? row[estHoursCol] : 0),
      compatible,
    };

    if (!sectionsMap.has(sectionName)) {
      sectionsMap.set(sectionName, []);
    }
    sectionsMap.get(sectionName).push(item);
  });

  const sections = Array.from(sectionsMap.entries()).map(([name, items]) => ({
    name,
    items,
  }));

  return {
    sections,
    vanTypes: compatibilityColumns.map(({ key }) => key),
    defaultLaborRate: 110,
    taxRate: 8.25,
  };
};

const formatMoney = (value) => numberFormatter.format(value || 0);

const renderVanTypes = () => {
  const options = [
    "<option value=''>Select van type</option>",
    ...state.catalog.vanTypes.map(
      (type) => `<option value="${escapeHtml(type)}">${escapeHtml(labelForVanType(type))}</option>`
    ),
  ];
  dom.vanType.innerHTML = options.join("");
};

const selectedItemsForSection = (section) => {
  const selections = state.selectedBySection[section.name] || [];
  return selections
    .map((selection) => {
      const item = section.items.find((entry) => entry.id === selection.id);
      if (!item) {
        return null;
      }

      const countValue = asNumber(selection.count);
      const markupValue = asNumber(selection.markup);
      const count = countValue > 0 ? countValue : 1;
      const markup = markupValue > 0 ? markupValue : 1.2;

      return {
        ...item,
        count,
        markup,
      };
    })
    .filter(Boolean);
};

const sectionTotals = (section) => {
  const items = selectedItemsForSection(section);
  const laborHours = items.reduce((sum, item) => sum + item.estimatedHours * item.count, 0);
  const materialCost = items.reduce(
    (sum, item) => sum + item.pricePerUnit * item.count * item.markup,
    0
  );
  const laborCost = laborHours * state.estimate.laborRate;
  const total = materialCost + laborCost;
  return { laborHours, materialCost, laborCost, total };
};

const setPanelCollapsed = (sectionName, collapsed) => {
  state.collapsedBySection[sectionName] = Boolean(collapsed);
};

const updateSelectedItemValues = (sectionName, itemId, field, rawValue) => {
  const selected = state.selectedBySection[sectionName] || [];
  const nextValue = asNumber(rawValue);

  state.selectedBySection[sectionName] = selected.map((entry) => {
    if (entry.id !== itemId) {
      return entry;
    }

    if (field === "count") {
      return {
        ...entry,
        count: nextValue > 0 ? nextValue : 1,
      };
    }

    if (field === "markup") {
      return {
        ...entry,
        markup: nextValue > 0 ? nextValue : 1.2,
      };
    }

    return entry;
  });
};

const totalsAcrossSections = () => {
  const totals = state.catalog.sections.map((section) => sectionTotals(section));
  const material = totals.reduce((sum, section) => sum + section.materialCost, 0);
  const labor = totals.reduce((sum, section) => sum + section.laborCost, 0);
  const preTax = material + labor;
  const tax = preTax * (state.estimate.taxRate / 100);
  return {
    material,
    labor,
    preTax,
    tax,
    total: preTax + tax,
  };
};

const sectionMarkup = (section) => {
  const selectedItems = selectedItemsForSection(section);
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const vanType = state.estimate.vanType;
  const collapsed = Boolean(state.collapsedBySection[section.name]);
  const totals = sectionTotals(section);

  const compatibleOptions = section.items.filter((item) => {
    if (selectedIds.has(item.id)) {
      return false;
    }
    if (!vanType) {
      return false;
    }
    return item.compatible.includes(vanType);
  });

  const optionsMarkup = compatibleOptions.length
    ? compatibleOptions
        .map(
          (item) =>
            `<option value="${escapeHtml(item.id)}">${escapeHtml(item.description)} (${formatMoney(item.pricePerUnit)}, ${item.estimatedHours.toFixed(2)} hrs)</option>`
        )
        .join("")
    : "<option value=''>No compatible items available</option>";

  const rowsMarkup = selectedItems.length
    ? selectedItems
        .map((item) => {
          const rowHours = item.estimatedHours * item.count;
          const materialCost = item.pricePerUnit * item.count * item.markup;
          const laborCost = rowHours * state.estimate.laborRate;
          const total = laborCost + materialCost;
          const linkMarkup = item.link
            ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Open</a>`
            : "-";

          return `<tr>
            <td>${escapeHtml(item.description)}</td>
            <td>${linkMarkup}</td>
            <td>${escapeHtml(item.itemSize || "-")}</td>
            <td>${formatMoney(item.pricePerUnit)}</td>
            <td class="no-print"><input class="line-input item-count" type="number" min="0.01" step="0.01" value="${item.count}" data-section="${escapeHtml(section.name)}" data-item="${escapeHtml(item.id)}" /></td>
            <td class="no-print"><input class="line-input item-markup" type="number" min="0.01" step="0.01" value="${item.markup.toFixed(2)}" data-section="${escapeHtml(section.name)}" data-item="${escapeHtml(item.id)}" /></td>
            <td>${formatMoney(materialCost)}</td>
            <td>${rowHours.toFixed(2)}</td>
            <td>${formatMoney(laborCost)}</td>
            <td>${formatMoney(total)}</td>
            <td class="no-print"><button class="secondary remove-item" data-section="${escapeHtml(section.name)}" data-item="${escapeHtml(item.id)}">Remove</button></td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="empty-row" colspan="11">No items selected in this panel yet.</td></tr>`;

  const pickerId = `pick-${sectionKey(section.name)}`;

  if (collapsed) {
    return `<article class="panel">
      <div class="section-header compact">
        <h2>${escapeHtml(section.name)}</h2>
        <div class="section-header-actions">
          <p class="section-total">${formatMoney(totals.total)}</p>
          <button class="secondary collapse-toggle no-print" data-section="${escapeHtml(section.name)}">Expand</button>
        </div>
      </div>
    </article>`;
  }

  return `<article class="panel">
    <div class="section-header">
      <h2>${escapeHtml(section.name)}</h2>
      <div class="section-header-actions">
        <p class="section-total">${formatMoney(totals.total)}</p>
        <button class="secondary collapse-toggle no-print" data-section="${escapeHtml(section.name)}">Collapse</button>
      </div>
    </div>

    <div class="section-controls no-print inline-controls">
      <select id="${escapeHtml(pickerId)}">
        <option value="">Select a compatible item</option>
        ${optionsMarkup}
      </select>
      <button class="add-item" data-section="${escapeHtml(section.name)}">Add</button>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th>Link</th>
          <th>Item Size</th>
          <th>Price Per Unit</th>
          <th class="no-print">Count</th>
          <th class="no-print">Markup</th>
          <th>Material Cost</th>
          <th>Est. Hours</th>
          <th>Labor Cost</th>
          <th>Total</th>
          <th class="no-print">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rowsMarkup}
      </tbody>
    </table>

    <div class="section-summary">
      <div class="pill">
        <h4>Subtotal Hours</h4>
        <p>${totals.laborHours.toFixed(2)}</p>
      </div>
      <div class="pill">
        <h4>Subtotal Labor</h4>
        <p>${formatMoney(totals.laborCost)}</p>
      </div>
      <div class="pill">
        <h4>Subtotal Material</h4>
        <p>${formatMoney(totals.materialCost)}</p>
      </div>
      <div class="pill">
        <h4>Panel Subtotal</h4>
        <p>${formatMoney(totals.total)}</p>
      </div>
    </div>
  </article>`;
};

const renderSections = () => {
  const markup = state.catalog.sections.map((section) => sectionMarkup(section)).join("");
  dom.sections.innerHTML = markup;
};

const renderTotals = () => {
  const totals = totalsAcrossSections();
  dom.overallMaterial.textContent = formatMoney(totals.material);
  dom.overallLabor.textContent = formatMoney(totals.labor);
  dom.overallPreTax.textContent = formatMoney(totals.preTax);
  dom.overallTax.textContent = formatMoney(totals.tax);
  dom.overallTotal.textContent = formatMoney(totals.total);
};

const renderPrintableMeta = () => {
  const title = `${state.estimate.year || ""} ${state.estimate.make || ""} ${state.estimate.model || ""}`
    .trim()
    .replace(/\s+/g, " ");
  dom.estimateMeta.innerHTML = `<h2>Estimate Details</h2>
    <p><strong>Van:</strong> ${escapeHtml(title || "Not specified")}</p>
    <p><strong>Compatibility Profile:</strong> ${escapeHtml(state.estimate.vanType || "Not selected")}</p>
    <p><strong>Labor Rate:</strong> ${formatMoney(state.estimate.laborRate)} / hr</p>
    <p><strong>Tax Rate:</strong> ${state.estimate.taxRate.toFixed(2)}%</p>`;
};

const render = () => {
  renderPrintableMeta();
  renderSections();
  renderTotals();
};

const onAddItem = (sectionName) => {
  const picker = document.getElementById(`pick-${sectionKey(sectionName)}`);
  const itemId = picker?.value;
  if (!itemId) {
    return;
  }

  const selected = state.selectedBySection[sectionName] || [];
  if (!selected.some((entry) => entry.id === itemId)) {
    state.selectedBySection[sectionName] = [
      ...selected,
      {
        id: itemId,
        count: 1,
        markup: 1.2,
      },
    ];
    render();
  }
};

const onRemoveItem = (sectionName, itemId) => {
  const selected = state.selectedBySection[sectionName] || [];
  state.selectedBySection[sectionName] = selected.filter((entry) => entry.id !== itemId);
  render();
};

const wireEvents = () => {
  dom.sections.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-item");
    if (addButton) {
      onAddItem(addButton.dataset.section);
      return;
    }

    const collapseButton = event.target.closest(".collapse-toggle");
    if (collapseButton) {
      const sectionName = collapseButton.dataset.section;
      const isCollapsed = Boolean(state.collapsedBySection[sectionName]);
      setPanelCollapsed(sectionName, !isCollapsed);
      render();
      return;
    }

    const removeButton = event.target.closest(".remove-item");
    if (removeButton) {
      onRemoveItem(removeButton.dataset.section, removeButton.dataset.item);
    }
  });

  dom.sections.addEventListener("change", (event) => {
    const countInput = event.target.closest(".item-count");
    if (countInput) {
      updateSelectedItemValues(
        countInput.dataset.section,
        countInput.dataset.item,
        "count",
        countInput.value
      );
      render();
      return;
    }

    const markupInput = event.target.closest(".item-markup");
    if (markupInput) {
      updateSelectedItemValues(
        markupInput.dataset.section,
        markupInput.dataset.item,
        "markup",
        markupInput.value
      );
      render();
    }
  });

  dom.year.addEventListener("input", () => {
    state.estimate.year = dom.year.value;
    renderPrintableMeta();
  });

  dom.make.addEventListener("input", () => {
    state.estimate.make = dom.make.value;
    renderPrintableMeta();
  });

  dom.model.addEventListener("input", () => {
    state.estimate.model = dom.model.value;
    renderPrintableMeta();
  });

  dom.vanType.addEventListener("change", () => {
    state.estimate.vanType = normalize(dom.vanType.value);
    for (const section of state.catalog.sections) {
      const filtered = selectedItemsForSection(section)
        .filter((item) => item.compatible.includes(state.estimate.vanType))
        .map((item) => ({
          id: item.id,
          count: item.count,
          markup: item.markup,
        }));
      state.selectedBySection[section.name] = filtered;
    }
    render();
  });

  dom.laborRate.addEventListener("input", () => {
    state.estimate.laborRate = asNumber(dom.laborRate.value);
    render();
  });

  dom.taxRate.addEventListener("input", () => {
    state.estimate.taxRate = asNumber(dom.taxRate.value);
    render();
  });

  dom.printButton.addEventListener("click", () => {
    window.print();
  });
};

const init = async () => {
  try {
    state.catalog = await loadCatalog();
    state.estimate.laborRate = state.catalog.defaultLaborRate;
    state.estimate.taxRate = state.catalog.taxRate;

    dom.laborRate.value = state.estimate.laborRate;
    dom.taxRate.value = state.estimate.taxRate;

    for (const section of state.catalog.sections) {
      state.selectedBySection[section.name] = [];
      state.collapsedBySection[section.name] = false;
    }

    dom.status.textContent = "Loaded data from Google Drive CSV source.";
    renderVanTypes();
    wireEvents();
    render();
  } catch (error) {
    dom.status.textContent =
      "Could not load data from Google Drive CSV source. Check link access and network connectivity.";
    dom.sections.innerHTML = "";
    console.error(error);
  }
};

init();
