import { dataNumber, formatNumber, formatSigned } from "./ui-utils.js";

function signName(value) {
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "zero";
}

function componentClass(componentKey) {
  return componentKey.toLowerCase().replaceAll("_", "-");
}

function rowKeyLabel(componentKey) {
  const labels = {
    SBE_SID: "SBE_SID",
    SBE_Alb: "SBE_Alb",
    SBE_UI: "SBE_UI",
    SBE_lactate: "SBE_lac",
    SBE_UI_non_lactate: "UI_non-lac",
  };
  return labels[componentKey] || componentKey;
}

function mobileComponentLabel(componentKey) {
  const labels = {
    SBE_SID: "Chloride / SID",
    SBE_Alb: "Albumin",
    SBE_UI: "Residual UI",
    SBE_lactate: "Lactate UI",
    SBE_UI_non_lactate: "Non-lactate UI",
  };
  return labels[componentKey] || componentKey;
}

function compactVisualLayout() {
  return window.matchMedia("(max-width: 560px)").matches;
}

function partitionVisualComponents(partition) {
  const components = [
    {
      key: "SBE_SID",
      label: "Chloride / SID",
      value: partition.sbe_sid,
    },
    {
      key: "SBE_Alb",
      label: "Albumin / weak acids",
      value: partition.sbe_alb,
    },
  ];

  if (partition.lactate) {
    components.push(
      {
        key: "SBE_lactate",
        label: "Lactate-attributable UI",
        value: partition.lactate.sbe_lactate,
      },
      {
        key: "SBE_UI_non_lactate",
        label: "Residual UI, non-lactate",
        value: partition.lactate.sbe_ui_non_lactate,
      },
    );
  } else {
    components.push({
      key: "SBE_UI",
      label: "Residual unmeasured ions",
      value: partition.sbe_ui,
    });
  }

  let cumulative = 0;
  return components.map((component, index) => {
    const start = cumulative;
    const end = start + component.value;
    cumulative = end;
    return {
      ...component,
      order: index + 1,
      start,
      end,
      sign: signName(component.value),
    };
  });
}

function niceDomainMax(values) {
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1);
  return Math.max(10, Math.ceil(maxAbs / 5) * 5);
}

function renderAnnotationList(annotations, refs) {
  refs.partitionAnnotations.replaceChildren();
  for (const annotation of annotations) {
    const item = document.createElement("li");
    item.dataset.annotation = annotation.key;
    item.textContent = annotation.text;
    refs.partitionAnnotations.append(item);
  }
}

function visualAnnotations(partition, result) {
  const annotations = [];
  if (partition.offsetting_components_present) {
    annotations.push({
      key: "offset",
      text:
        "Total SBE is near zero, but the components do not cancel to normal; they cancel each other.",
    });
  }
  if (partition.sid_reference_adjusted) {
    annotations.push({
      key: "sid-reference-adjusted",
      text: "SID reference was adjusted because pH was outside the paper's 7.30-7.50 range.",
    });
  }
  if (partition.lactate) {
    annotations.push({
      key: "lactate-split",
      text:
        "Lactate is split from residual UI so the non-lactate unmeasured-ion effect remains visible.",
    });
  }
  if (result.narrative.cautions.some((note) => note.includes("chronic hypercapnia"))) {
    annotations.push({
      key: "chronic-hypercapnia",
      text: "Chronic hypercapnia can create a positive SID contribution via renal chloride loss.",
    });
  }
  return annotations;
}

function renderPartitionChart(result, refs) {
  const partition = result.partition;
  const components = partitionVisualComponents(partition);
  const compact = compactVisualLayout();
  const domainMax = niceDomainMax([
    partition.sbe_total,
    ...components.flatMap((component) => [component.start, component.end, component.value]),
  ]);

  const width = compact ? 360 : 860;
  const plotLeft = compact ? 56 : 124;
  const plotRight = compact ? 340 : 812;
  const zeroX = (plotLeft + plotRight) / 2;
  const top = compact ? 84 : 74;
  const rowHeight = compact ? 60 : 52;
  const chartBottom = top + rowHeight * components.length - 18;
  const height = chartBottom + 72;
  const scaleX = (value) => zeroX + (value / domainMax) * ((plotRight - plotLeft) / 2);
  const ticks = [-domainMax, -domainMax / 2, 0, domainMax / 2, domainMax];

  const axisLines = ticks
    .map((tick) => {
      const x = scaleX(tick);
      const isZero = tick === 0;
      return `
        <line class="${isZero ? "zero-line" : "grid-line"}" x1="${x}" x2="${x}" y1="42" y2="${chartBottom}" />
        <text class="axis-label" x="${x}" y="${height - 24}" text-anchor="middle">${formatSigned(tick)}</text>
      `;
    })
    .join("");

  const rows = components
    .map((component) => {
      const y = top + (component.order - 1) * rowHeight;
      const startX = scaleX(component.start);
      const endX = scaleX(component.end);
      const x = Math.min(startX, endX);
      const segmentWidth = Math.max(Math.abs(endX - startX), 2);
      const midX = (startX + endX) / 2;
      const labelFits = segmentWidth >= 210;
      const fallbackX = component.value < 0 ? startX - 10 : startX + 10;
      const labelX = compact ? plotRight : labelFits ? midX : fallbackX;
      const anchor = compact ? "end" : labelFits ? "middle" : component.value < 0 ? "end" : "start";
      const labelText = compact
        ? `${formatSigned(component.value)} mmol/L`
        : `${component.label}: ${formatSigned(component.value)}`;
      const rowLabelText = compact ? mobileComponentLabel(component.key) : rowKeyLabel(component.key);
      const rowLabelY = compact ? y - 20 : y + 5;
      const segmentLabelY = compact ? y - 20 : y + 5;
      const nextY = y + rowHeight;
      const connector =
        component.order < components.length
          ? `<line class="step-connector" x1="${endX}" x2="${endX}" y1="${y + 14}" y2="${nextY - 14}" />`
          : "";

      return `
        <g class="partition-row" data-row="${component.order}">
          <text class="row-label" x="18" y="${rowLabelY}">${rowLabelText}</text>
          <line class="row-baseline" x1="${plotLeft}" x2="${plotRight}" y1="${y}" y2="${y}" />
          <rect
            class="partition-segment segment-${componentClass(component.key)}"
            data-component="${component.key}"
            data-order="${component.order}"
            data-sign="${component.sign}"
            data-value="${dataNumber(component.value)}"
            data-start="${dataNumber(component.start)}"
            data-end="${dataNumber(component.end)}"
            x="${x}"
            y="${y - 13}"
            width="${segmentWidth}"
            height="26"
            rx="4"
          />
          <text
            class="partition-segment-label"
            data-label-for="${component.key}"
            x="${labelX}"
            y="${segmentLabelY}"
            text-anchor="${anchor}"
          >${labelText}</text>
          ${connector}
        </g>
      `;
    })
    .join("");

  const totalX = scaleX(partition.sbe_total);
  const svg = `
    <svg
      class="visual-svg partition-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-labelledby="partition-svg-title partition-svg-desc"
      data-domain-max="${dataNumber(domainMax)}"
    >
      <title id="partition-svg-title">Base excess partition bar</title>
      <desc id="partition-svg-desc">
        Sequential Stewart Light components sum to measured SBE of ${formatSigned(
          partition.sbe_total,
        )} mmol/L.
      </desc>
      <text class="direction-label" x="${plotLeft}" y="24" text-anchor="start">Acidifying direction</text>
      <text class="direction-label" x="${plotRight}" y="24" text-anchor="end">Alkalinizing direction</text>
      <line class="axis-line" x1="${plotLeft}" x2="${plotRight}" y1="${height - 42}" y2="${height - 42}" />
      ${axisLines}
      ${rows}
      <line
        id="sbe-total-marker"
        class="total-marker"
        data-value="${dataNumber(partition.sbe_total)}"
        x1="${totalX}"
        x2="${totalX}"
        y1="38"
        y2="${chartBottom + 14}"
      />
      <text class="total-label" x="${totalX}" y="${chartBottom + 38}" text-anchor="middle">
        measured SBE ${formatSigned(partition.sbe_total)} mmol/L
      </text>
      <text class="axis-unit" x="${plotRight}" y="${height - 4}" text-anchor="end">mmol/L</text>
    </svg>
  `;

  refs.partitionChart.innerHTML = svg;
  refs.partitionChart.setAttribute(
    "aria-label",
    `Base excess partition. Components sum to measured SBE ${formatSigned(
      partition.sbe_total,
    )} mmol/L.`,
  );
  refs.partitionSummary.className = "visual-summary";
  refs.partitionSummary.textContent = `The visual steps reconstruct measured SBE ${formatSigned(
    partition.sbe_total,
  )} mmol/L from ${components.length} component${components.length === 1 ? "" : "s"}.`;
  renderAnnotationList(visualAnnotations(partition, result), refs);
}

function renderTeachingDiagram(result, refs) {
  const input = result.input;
  const partition = result.partition;
  const compact = compactVisualLayout();
  const sidGap = input.na_mmol_l - input.cl_mmol_l;
  const maxGap = Math.max(45, Math.abs(sidGap), Math.abs(partition.sid_reference));
  const width = compact ? 360 : 760;
  const height = compact ? 370 : 300;
  const xStart = compact ? 42 : 92;
  const xMax = compact ? 304 : 568;
  const gapWidth = Math.max(64, (Math.abs(sidGap) / maxGap) * (xMax - xStart));
  const refWidth = Math.max(64, (Math.abs(partition.sid_reference) / maxGap) * (xMax - xStart));
  const xCl = xStart + gapWidth;
  const xRef = xStart + refWidth;
  const residualLabel = partition.lactate
    ? `UI ${formatSigned(partition.sbe_ui)} total`
    : `UI ${formatSigned(partition.sbe_ui)}`;
  const sidAdjustment = partition.sid_reference_adjusted
    ? `<line class="reference-tick" x1="${xRef}" x2="${xRef}" y1="60" y2="142" />
       <text class="teaching-note" x="${xRef}" y="154" text-anchor="middle">${
         compact ? "pH SID ref" : "pH-adjusted SID ref"
       } ${formatNumber(
         partition.sid_reference,
       )}</text>`
    : "";
  const slots = compact
    ? [
        ["sid", 18, 204, 154, "SID effect", `SBE_SID ${formatSigned(partition.sbe_sid)}`],
        ["albumin", 188, 204, 154, "Weak acids", `SBE_Alb ${formatSigned(partition.sbe_alb)}`],
        ["bicarbonate", 18, 270, 154, "HCO3 space", `${formatNumber(input.hco3_mmol_l)} mmol/L`],
        ["ui", 188, 270, 154, "Residual UI", residualLabel],
      ]
    : [
        ["sid", 82, 198, 142, "SID effect", `SBE_SID ${formatSigned(partition.sbe_sid)}`],
        ["albumin", 234, 198, 154, "Weak acids", `SBE_Alb ${formatSigned(partition.sbe_alb)}`],
        ["bicarbonate", 398, 198, 132, "HCO3 space", `${formatNumber(input.hco3_mmol_l)} mmol/L`],
        ["ui", 540, 198, 138, "Residual UI", residualLabel],
      ];
  const conceptSlots = slots
    .map(
      ([key, x, y, slotWidth, title, value]) => `
        <g class="concept-slot" data-concept="${key}" transform="translate(${x} ${y})">
          <rect width="${slotWidth}" height="58" rx="6" />
          <text x="12" y="22">${title}</text>
          <text x="12" y="43">${value}</text>
        </g>
      `,
    )
    .join("");
  const footnote = compact
    ? "Educational simplification: minor ions omitted."
    : "Educational simplification: minor ions and full electroneutrality terms are intentionally omitted.";

  const svg = `
    <svg
      class="visual-svg teaching-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-labelledby="teaching-svg-title teaching-svg-desc"
    >
      <title id="teaching-svg-title">Simplified Stewart Light calliper diagram</title>
      <desc id="teaching-svg-desc">
        Sodium and chloride anchors define the SID gap; albumin and residual unmeasured ions are shown separately.
      </desc>
      <line class="anchor-line" x1="${xStart}" x2="${xStart}" y1="48" y2="168" />
      <line class="anchor-line" x1="${xCl}" x2="${xCl}" y1="48" y2="168" />
      <circle class="anchor-dot sodium-dot" cx="${xStart}" cy="62" r="8" />
      <circle class="anchor-dot chloride-dot" cx="${xCl}" cy="62" r="8" />
      <text class="anchor-label" x="${xStart}" y="34" text-anchor="middle">Na ${formatNumber(
        input.na_mmol_l,
      )}</text>
      <text class="anchor-label" x="${xCl}" y="34" text-anchor="middle">Cl ${formatNumber(
        input.cl_mmol_l,
      )}</text>
      <path class="sid-bracket" d="M ${xStart} 106 L ${xStart} 92 L ${xCl} 92 L ${xCl} 106" />
      <text class="sid-label" x="${(xStart + xCl) / 2}" y="126" text-anchor="middle">
        Na - Cl gap / SID ${formatNumber(sidGap)} mmol/L
      </text>
      ${sidAdjustment}
      ${conceptSlots}
      <text class="teaching-footnote" x="${compact ? 18 : 82}" y="${compact ? 348 : 282}">
        ${footnote}
      </text>
    </svg>
  `;

  refs.teachingDiagram.innerHTML = svg;
  refs.teachingDiagram.setAttribute(
    "aria-label",
    `Simplified calliper diagram. Sodium minus chloride is ${formatNumber(
      sidGap,
    )} mmol/L and SID reference is ${formatNumber(partition.sid_reference)} mmol/L.`,
  );
  refs.teachingSummary.className = "visual-summary";
  refs.teachingSummary.textContent = `Na - Cl is ${formatNumber(sidGap)} mmol/L. The Stewart Light model compares that strong-ion gap with the SID reference, then separates albumin and residual UI effects.`;
}

export function renderCompensationMap(result, refs) {
  const map = result.compensation_map;
  const compact = compactVisualLayout();
  const width = compact ? 360 : 720;
  const height = compact ? 300 : 360;
  const left = compact ? 42 : 70;
  const right = compact ? 338 : 670;
  const top = compact ? 36 : 34;
  const bottom = compact ? 238 : 292;
  const minX = 15;
  const maxX = 90;
  const minY = -25;
  const maxY = 25;
  const scaleX = (value) => left + ((value - minX) / (maxX - minX)) * (right - left);
  const scaleY = (value) => bottom - ((value - minY) / (maxY - minY)) * (bottom - top);
  const chronicLine = [
    [15, 0.4 * (15 - 40)],
    [90, 0.4 * (90 - 40)],
  ];
  const metabolicAcidosisLine = [
    [40 + minY, minY],
    [40, 0],
  ];
  const metabolicAlkalosisLine = [
    [40, 0],
    [40 + 0.6 * maxY, maxY],
  ];
  const linePath = (points) =>
    points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${scaleX(x)} ${scaleY(y)}`)
      .join(" ");
  const patientX = scaleX(map.patient_pco2_mmhg);
  const patientY = scaleY(map.patient_sbe_mmol_l);
  const acuteLabel = compact ? "acute" : "acute respiratory SBE 0";
  const chronicLabel = compact ? "chronic" : "chronic respiratory guide";
  const acidosisLabel = compact ? "met acid" : "metabolic acidosis guide";
  const alkalosisLabel = compact ? "met alk" : "metabolic alkalosis guide";
  const sbeAxisLabel = `<text class="axis-unit" x="${left}" y="${top - 8}">SBE (mmol/L)</text>`;

  refs.compensationMap.innerHTML = `
    <svg
      class="visual-svg compensation-map-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-labelledby="compensation-map-svg-title compensation-map-svg-desc"
    >
      <title id="compensation-map-svg-title">Boston SBE vs PaCO2 compensation map</title>
      <desc id="compensation-map-svg-desc">
        Patient point plotted against Boston-style acute respiratory, chronic respiratory, and metabolic compensation guides.
      </desc>
      <line class="axis-line" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" />
      <line class="axis-line" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" />
      <line class="grid-line" x1="${left}" x2="${right}" y1="${scaleY(0)}" y2="${scaleY(0)}" />
      <line class="grid-line" x1="${scaleX(40)}" x2="${scaleX(40)}" y1="${top}" y2="${bottom}" />
      <path class="map-guide acute-guide" data-guide="acute-respiratory" d="M ${left} ${scaleY(0)} L ${right} ${scaleY(0)}" />
      <path class="map-guide chronic-guide" data-guide="chronic-respiratory" d="${linePath(chronicLine)}" />
      <path class="map-guide metabolic-acidosis-guide" data-guide="metabolic-acidosis" d="${linePath(metabolicAcidosisLine)}" />
      <path class="map-guide metabolic-alkalosis-guide" data-guide="metabolic-alkalosis" d="${linePath(metabolicAlkalosisLine)}" />
      <circle class="normal-point" cx="${scaleX(40)}" cy="${scaleY(0)}" r="5" />
      <circle
        id="compensation-patient-point"
        class="patient-point"
        data-pco2="${dataNumber(map.patient_pco2_mmhg)}"
        data-sbe="${dataNumber(map.patient_sbe_mmol_l)}"
        cx="${patientX}"
        cy="${patientY}"
        r="7"
      />
      <text class="map-label" x="${scaleX(40) + 10}" y="${scaleY(0) - 8}">normal (40, 0)</text>
      <text class="map-label" x="${patientX + 10}" y="${patientY - 10}">patient</text>
      <text class="map-label" x="${right}" y="${scaleY(0) - 8}" text-anchor="end">${acuteLabel}</text>
      <text class="map-label" x="${scaleX(compact ? 70 : 75)}" y="${scaleY(compact ? 12 : 14)}">${chronicLabel}</text>
      <text class="map-label" x="${scaleX(compact ? 23 : 25)}" y="${scaleY(compact ? -14 : -17)}">${acidosisLabel}</text>
      <text class="map-label" x="${scaleX(compact ? 47 : 50)}" y="${scaleY(compact ? 16 : 18)}">${alkalosisLabel}</text>
      <text class="axis-unit" x="${right}" y="${height - 14}" text-anchor="end">PaCO2 (mmHg)</text>
      ${sbeAxisLabel}
    </svg>
  `;
  refs.compensationMapNote.textContent = `${map.note} Patient point is closest to the ${map.closest_region}.`;
}

export function renderVisuals(result, refs) {
  renderPartitionChart(result, refs);
  renderTeachingDiagram(result, refs);
}
