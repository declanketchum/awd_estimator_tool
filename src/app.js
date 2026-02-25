const EXCEL_EMBED_URL =
  "https://1drv.ms/x/c/2f17e48ccd89da80/IQQAUD9hKxCWQL2iPFAs0DdDAXp6zWDmoNVmf6lgpGCpXY4?em=2&wdAllowInteractivity=False&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True";
const FALLBACK_JSON_PATH = "./data/catalog.json";

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
  printButton: document.getElementById("print-button")
};

const state = {
  catalog: null,
  selectedBySection: {},
  estimate: {
    year: "",
    make: "",
    model: "",
    vanType: "",
    laborRate: 110,
    taxRate: 8.25
  }
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const makeId = (sectionName, rowIndex) =>
  `${sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${rowIndex}`;

const sectionKey = (sectionName) =>
  sectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

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

const normalize = (value) => String(value || "").trim().toLowerCase();

const pickColumn = (headers, candidates) => {
  const normalizedHeaders = headers.map((h) => normalize(h));
  return normalizedHeaders.findIndex((header) =>
    candidates.some((candidate) => header.includes(candidate))
  );
};

const knownColumn = (name) => {
  const value = normalize(name);
  const known = [
    "product",
    "item",
    "name",
    "material",
    "labor",
    "hours",
    "cost",
    "notes",
    "description",
    "sku",
    "part",
    "quantity",
    "qty",
    "unit",
    "total"
  ];

  return known.some((token) => value.includes(token));
};

const tableFromSheet = (sheetName, rows) => {
  if (!rows.length) {
    return null;
  }

  const [headerRow, ...bodyRows] = rows;
  const headers = headerRow.map((header) => String(header || "").trim());
  const productCol = pickColumn(headers, ["product", "item", "name"]);
  const materialCol = pickColumn(headers, ["material cost", "material", "parts cost", "price"]);
  const laborHoursCol = pickColumn(headers, ["labor hours", "hours", "install hours", "labor time"]);

  if (productCol < 0) {
    return null;
  }

  const compatibilityColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => index !== productCol && index !== materialCol && index !== laborHoursCol)
    .filter(({ header }) => header && !knownColumn(header));

  const items = bodyRows
    .filter((row) => row[productCol])
    .map((row, rowIndex) => {
      const compatible = compatibilityColumns
        .filter(({ index }) => yesValue(row[index]))
        .map(({ header }) => normalize(header));

      return {
        id: makeId(sheetName, rowIndex),
        product: String(row[productCol]).trim(),
        materialCost: asNumber(row[materialCol]),
        laborHours: asNumber(row[laborHoursCol]),
        compatible
      };
    });

  return {
    name: sheetName,
    items
  };
};

const normalizeCatalog = (rawCatalog) => {
  if (!rawCatalog?.sections?.length) {
    throw new Error("Catalog is missing sections");
  }

  const sections = rawCatalog.sections.map((section) => ({
    name: section.name,
    items: (section.items || []).map((item, idx) => ({
      id: item.id || makeId(section.name, idx),
      product: String(item.product || "").trim(),
      materialCost: asNumber(item.materialCost),
      laborHours: asNumber(item.laborHours),
      compatible: (item.compatible || []).map((entry) => normalize(entry))
    }))
  }));

  const vanTypes = Array.from(
    new Set(
      sections.flatMap((section) =>
        section.items.flatMap((item) => item.compatible.filter(Boolean))
      )
    )
  ).sort();

  return {
    sections,
    vanTypes,
    defaultLaborRate: asNumber(rawCatalog.defaultLaborRate) || 110,
    taxRate: asNumber(rawCatalog.taxRate) || 8.25
  };
};

const loadCatalogFromExcel = async (sourceUrl) => {
  if (!window.XLSX) {
    throw new Error("SheetJS is unavailable");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Excel request failed with ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array" });
  const sections = workbook.SheetNames.map((sheetName) => {
    const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: ""
    });
    return tableFromSheet(sheetName, rows);
  }).filter(Boolean);

  return normalizeCatalog({ sections });
};

const loadCatalogFallback = async () => {
  const response = await fetch(FALLBACK_JSON_PATH);
  if (!response.ok) {
    throw new Error(`Fallback data request failed with ${response.status}`);
  }
  const json = await response.json();
  return normalizeCatalog(json);
};

const loadCatalog = async () => {
  try {
    const catalog = await loadCatalogFromExcel(EXCEL_EMBED_URL);
    dom.status.textContent = "Loaded data from the Excel source.";
    return catalog;
  } catch (error) {
    const catalog = await loadCatalogFallback();
    dom.status.textContent =
      "Could not load data directly from the Excel embed URL in browser mode. Using local JSON fallback. See README for direct OneDrive download-link setup.";
    return catalog;
  }
};

const formatMoney = (value) => numberFormatter.format(value || 0);

const renderVanTypes = () => {
  const options = [
    "<option value=''>Select van type</option>",
    ...state.catalog.vanTypes.map(
      (type) => `<option value="${type}">${type[0].toUpperCase()}${type.slice(1)}</option>`
    )
  ];
  dom.vanType.innerHTML = options.join("");
};

const selectedItemsForSection = (section) => {
  const ids = state.selectedBySection[section.name] || [];
  return ids
    .map((id) => section.items.find((item) => item.id === id))
    .filter(Boolean);
};

const sectionTotals = (section) => {
  const items = selectedItemsForSection(section);
  const laborHours = items.reduce((sum, item) => sum + item.laborHours, 0);
  const materialCost = items.reduce((sum, item) => sum + item.materialCost, 0);
  const laborCost = laborHours * state.estimate.laborRate;
  const total = materialCost + laborCost;
  return { laborHours, materialCost, laborCost, total };
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
    total: preTax + tax
  };
};

const sectionMarkup = (section) => {
  const selectedItems = selectedItemsForSection(section);
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const vanType = state.estimate.vanType;

  const compatibleOptions = section.items.filter(
    (item) => vanType && item.compatible.includes(vanType) && !selectedIds.has(item.id)
  );

  const optionsMarkup = compatibleOptions.length
    ? compatibleOptions
        .map(
          (item) =>
            `<option value="${item.id}">${item.product} (${formatMoney(item.materialCost)}, ${item.laborHours} hrs)</option>`
        )
        .join("")
    : "<option value=''>No compatible products available</option>";

  const rowsMarkup = selectedItems.length
    ? selectedItems
        .map((item) => {
          const laborCost = item.laborHours * state.estimate.laborRate;
          const total = laborCost + item.materialCost;
          return `<tr>
            <td>${item.product}</td>
            <td>${formatMoney(item.materialCost)}</td>
            <td>${item.laborHours.toFixed(2)}</td>
            <td>${formatMoney(laborCost)}</td>
            <td>${formatMoney(total)}</td>
            <td class="no-print"><button class="secondary remove-item" data-section="${section.name}" data-item="${item.id}">Remove</button></td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="empty-row" colspan="6">No products selected in this section yet.</td></tr>`;

  const totals = sectionTotals(section);

  const pickerId = `pick-${sectionKey(section.name)}`;

  return `<article class="panel">
    <div class="section-header">
      <h2>${section.name}</h2>
      <div class="section-controls no-print">
        <select id="${pickerId}">
          <option value="">Select a compatible product</option>
          ${optionsMarkup}
        </select>
        <button class="add-item" data-section="${section.name}">Add</button>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Material Cost</th>
          <th>Labor Hours</th>
          <th>Labor Cost</th>
          <th>Total Cost</th>
          <th class="no-print">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rowsMarkup}
      </tbody>
    </table>

    <div class="section-summary">
      <div class="pill">
        <h4>Labor Hours</h4>
        <p>${totals.laborHours.toFixed(2)}</p>
      </div>
      <div class="pill">
        <h4>Labor Cost</h4>
        <p>${formatMoney(totals.laborCost)}</p>
      </div>
      <div class="pill">
        <h4>Material Cost</h4>
        <p>${formatMoney(totals.materialCost)}</p>
      </div>
      <div class="pill">
        <h4>Section Total</h4>
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
    <p><strong>Van:</strong> ${title || "Not specified"}</p>
    <p><strong>Compatibility Profile:</strong> ${state.estimate.vanType || "Not selected"}</p>
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
  if (!selected.includes(itemId)) {
    state.selectedBySection[sectionName] = [...selected, itemId];
    render();
  }
};

const onRemoveItem = (sectionName, itemId) => {
  const selected = state.selectedBySection[sectionName] || [];
  state.selectedBySection[sectionName] = selected.filter((id) => id !== itemId);
  render();
};

const wireEvents = () => {
  dom.sections.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-item");
    if (addButton) {
      onAddItem(addButton.dataset.section);
      return;
    }

    const removeButton = event.target.closest(".remove-item");
    if (removeButton) {
      onRemoveItem(removeButton.dataset.section, removeButton.dataset.item);
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
        .map((item) => item.id);
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
  state.catalog = await loadCatalog();
  state.estimate.laborRate = state.catalog.defaultLaborRate;
  state.estimate.taxRate = state.catalog.taxRate;

  dom.laborRate.value = state.estimate.laborRate;
  dom.taxRate.value = state.estimate.taxRate;

  for (const section of state.catalog.sections) {
    state.selectedBySection[section.name] = [];
  }

  renderVanTypes();
  wireEvents();
  render();
};

init();
