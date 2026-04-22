from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

pytestmark = pytest.mark.e2e


def attach_error_collectors(page: Page) -> tuple[list[str], list[str]]:
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on(
        "console",
        lambda message: console_errors.append(message.text) if message.type == "error" else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    return console_errors, page_errors


def open_ready_app(app_url: str, page: Page) -> tuple[list[str], list[str]]:
    console_errors, page_errors = attach_error_collectors(page)
    page.goto(app_url)
    expect(page.locator("#runtime-status")).to_contain_text("Ready", timeout=120_000)
    return console_errors, page_errors


def fill_valid_case(page: Page) -> None:
    page.locator("#ph").fill("7.22")
    page.locator("#pco2").fill("25")
    page.locator("#hco3").fill("10")
    page.locator("#sbe").fill("-18")
    page.locator("#sodium").fill("140")
    page.locator("#chloride").fill("104")
    page.locator("#albumin").fill("40")
    page.locator("#lactate").fill("6")


def submit_and_wait(page: Page) -> None:
    page.locator("#calculate-button").click()
    expect(page.locator("#headline-card")).to_contain_text(
        "Stewart Light suggests", timeout=120_000
    )


def test_app_loads_engine_and_shows_privacy_disclaimer(app_url: str, page: Page) -> None:
    console_errors, page_errors = open_ready_app(app_url, page)

    expect(page.locator("h1")).to_have_text("Acid-base calculator")
    expect(page.locator("#why-title")).to_have_text(
        "Stewart Light decomposes multiple metabolic processes."
    )
    expect(page.locator(".why-panel")).to_contain_text("Duška et al.")
    expect(
        page.locator('.why-panel a[href="https://doi.org/10.1007/s00134-026-08416-3"]')
    ).to_have_count(1)
    expect(page.locator("#step-one-details")).to_be_hidden()
    expect(page.locator("#hydrogen-card")).to_be_hidden()
    expect(page.locator("#hydrogen-chip")).to_have_text("")
    expect(page.locator("#anion-gap-card")).to_be_hidden()
    expect(page.locator("#lab-caveats-card")).to_be_hidden()
    expect(page.locator("#normalized-card")).to_be_hidden()
    expect(page.locator("footer")).to_contain_text("not a medical device")
    expect(page.locator("footer")).to_contain_text("No patient data are transmitted")
    expect(page.locator("footer")).to_contain_text("not stored in the URL or local storage")

    assert page_errors == []
    assert console_errors == []


def test_valid_manual_submission_returns_structured_results(app_url: str, page: Page) -> None:
    console_errors, page_errors = open_ready_app(app_url, page)

    fill_valid_case(page)
    submit_and_wait(page)

    expect(page.locator("#step-one-title")).to_have_text(
        "Clinical context, pH severity, and Boston rules"
    )
    expect(page.locator("#step-one-card .step-label")).to_have_text("Step 1")
    expect(page.locator("#step-one-details")).to_be_visible()
    expect(page.locator("#boston-title")).to_have_text("Boston compensation view")
    expect(page.locator("#boston-details")).to_contain_text("metabolic acidosis likely")
    expect(page.locator("#hydrogen-card")).to_be_visible()
    expect(page.locator("#hydrogen-chip")).to_contain_text("pH 7.22")
    expect(page.locator("#stewart-details")).to_contain_text("SBE_UI")
    expect(page.locator("#what-adds")).to_contain_text(
        "Stewart Light keeps the traditional compensation assessment"
    )
    expect(page.locator("#comparison-title")).to_have_text(
        "Synthesize the Boston and Stewart Light views"
    )
    expect(page.locator("#comparison-card .step-label")).to_have_text("Synthesis")
    expect(page.locator("#partition-title")).to_have_text("Partition measured SBE")
    expect(page.locator("#partition-visual-card .step-label")).to_have_text("Steps 2-4")
    expect(page.locator("#partition-visual-card")).to_contain_text("Step 2: Strong-ion effect.")
    expect(page.locator("#partition-visual-card")).to_contain_text(
        "SID reference = 35 + 15 * (7.40 - pH)"
    )
    expect(page.locator("#partition-visual-card")).to_contain_text("1.5 mmol/L per 0.10 pH unit")
    expect(page.locator("#partition-visual-card")).to_contain_text("SBE_Alb = 0.3")
    expect(page.locator("#partition-visual-card")).to_contain_text(
        "SBE_UI = SBE - SBE_SID - SBE_Alb"
    )
    expect(page.locator("#teaching-title")).to_have_text(
        "Why can the total look normal even when components are not?"
    )
    expect(page.locator("body")).not_to_contain_text("Visualization placeholder")
    expect(page.locator("#base-excess-card")).to_contain_text(
        "several types of processes that can result in the same HCO3 / SBE"
    )
    expect(page.locator("#anion-gap-card")).to_contain_text("Anion gap context")
    expect(page.locator("#hydrogen-card")).to_contain_text("pH")
    expect(page.locator("#lab-caveats-card")).to_contain_text("air bubbles")

    assert page_errors == []
    assert console_errors == []


def test_result_cards_follow_stewart_light_step_order(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    fill_valid_case(page)
    submit_and_wait(page)

    order = page.evaluate(
        """() => {
            const cards = Array.from(document.querySelectorAll(".output-panel > article"));
            return [
                "base-excess-card",
                "step-one-card",
                "partition-visual-card",
                "comparison-card",
            ].map((id) => cards.findIndex((card) => card.id === id));
        }"""
    )
    assert order == sorted(order)
    assert all(index >= 0 for index in order)


def test_required_field_validation_blocks_submit_and_focuses_field(
    app_url: str, page: Page
) -> None:
    open_ready_app(app_url, page)
    fill_valid_case(page)
    page.locator("#ph").fill("")
    page.locator("#calculate-button").click()

    expect(page.locator("#form-errors")).to_contain_text("pH is required")
    assert page.evaluate("document.activeElement.id") == "ph"
    expect(page.locator("#headline-card")).to_contain_text("Enter values and calculate")


def test_unit_conversion_displays_normalized_values(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#ph").fill("7.40")
    page.locator("#pco2").fill("5")
    page.locator("#pco2-unit").select_option("kPa")
    page.locator("#hco3").fill("24")
    page.locator("#sbe").fill("0")
    page.locator("#sodium").fill("140")
    page.locator("#chloride").fill("105")
    page.locator("#albumin").fill("4.2")
    page.locator("#albumin-unit").select_option("g/dL")
    submit_and_wait(page)

    expect(page.locator("#normalized-details")).to_contain_text("37.5 mmHg")
    expect(page.locator("#normalized-details")).to_contain_text("entered as 5 kPa")
    expect(page.locator("#normalized-details")).to_contain_text("42.0 g/L")
    expect(page.locator("#normalized-details")).to_contain_text("entered as 4.2 g/dL")


def test_example_selector_starts_blank_then_populates_and_calculates(
    app_url: str, page: Page
) -> None:
    open_ready_app(app_url, page)

    expect(page.locator("#example-select")).to_have_value("")
    expect(page.locator("#ph")).to_have_value("")
    expect(page.locator("#load-example-button")).to_be_disabled()

    page.locator("#example-select").select_option("unmeasured-ion")

    expect(page.locator("#ph")).to_have_value("7.22")
    expect(page.locator("#pco2")).to_have_value("25")
    expect(page.locator("#hco3")).to_have_value("10")
    expect(page.locator("#sbe")).to_have_value("-18")
    expect(page.locator("#sodium")).to_have_value("140")
    expect(page.locator("#chloride")).to_have_value("104")
    expect(page.locator("#albumin")).to_have_value("40")
    expect(page.locator("#lactate")).to_have_value("6")
    expect(page.locator("#load-example-button")).to_be_enabled()
    expect(page.locator("#headline-card")).to_contain_text(
        "Stewart Light suggests", timeout=120_000
    )


def test_example_selection_clears_required_field_errors(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#calculate-button").click()
    expect(page.locator("#form-errors")).to_contain_text("pH is required")

    page.locator("#example-select").select_option("hyperchloremic")

    expect(page.locator("#form-errors")).to_be_hidden()
    expect(page.locator("#ph")).to_have_value("7.28")
    expect(page.locator("#headline-card")).to_contain_text(
        "Stewart Light suggests", timeout=120_000
    )


def test_reload_selected_example_restores_fixture_values(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("masked")
    expect(page.locator("#ph")).to_have_value("7.40")
    page.locator("#ph").fill("7.99")

    page.locator("#load-example-button").click()

    expect(page.locator("#ph")).to_have_value("7.40")
    expect(page.locator("#headline-card")).to_contain_text(
        "Stewart Light suggests", timeout=120_000
    )


@pytest.mark.parametrize(
    ("example_key", "expected_text"),
    [
        ("unmeasured-ion", "residual unmeasured ions"),
        ("hyperchloremic", "chloride/SID"),
        ("hypoalbuminemic", "Albumin / weak acids"),
        ("masked", "offsetting abnormalities"),
        ("chronic-hypercapnia", "chronic hypercapnia"),
    ],
)
def test_example_cases_populate_and_calculate(
    app_url: str, page: Page, example_key: str, expected_text: str
) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option(example_key)

    expect(page.locator("#headline-card")).to_contain_text(
        "Stewart Light suggests", timeout=120_000
    )
    expect(page.locator(".output-panel")).to_contain_text(expected_text)


def test_masked_near_normal_sbe_shows_nonzero_components(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("masked")

    expect(page.locator("#stewart-details")).to_contain_text("SBE_SID")
    expect(page.locator("#stewart-details")).to_contain_text("-6.0 mmol/L")
    expect(page.locator("#stewart-details")).to_contain_text("SBE_Alb")
    expect(page.locator("#stewart-details")).to_contain_text("6.0 mmol/L")
    expect(page.locator("#what-adds")).to_contain_text("total SBE is near zero")
    expect(page.locator("#form-warnings")).to_be_hidden()


def test_partition_chart_segment_order_signs_and_total_marker(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("masked")
    expect(page.locator(".partition-segment")).to_have_count(3, timeout=120_000)

    sid_segment = page.locator(".partition-segment").nth(0)
    albumin_segment = page.locator(".partition-segment").nth(1)
    ui_segment = page.locator(".partition-segment").nth(2)

    expect(sid_segment).to_have_attribute("data-component", "SBE_SID")
    expect(sid_segment).to_have_attribute("data-order", "1")
    expect(sid_segment).to_have_attribute("data-sign", "negative")
    expect(sid_segment).to_have_attribute("data-start", "0.0")
    expect(sid_segment).to_have_attribute("data-end", "-6.0")

    expect(albumin_segment).to_have_attribute("data-component", "SBE_Alb")
    expect(albumin_segment).to_have_attribute("data-order", "2")
    expect(albumin_segment).to_have_attribute("data-sign", "positive")
    expect(albumin_segment).to_have_attribute("data-start", "-6.0")
    expect(albumin_segment).to_have_attribute("data-end", "0.0")

    expect(ui_segment).to_have_attribute("data-component", "SBE_UI")
    expect(ui_segment).to_have_attribute("data-order", "3")
    expect(ui_segment).to_have_attribute("data-sign", "zero")
    expect(ui_segment).to_have_attribute("data-value", "0.0")
    expect(page.locator("#sbe-total-marker")).to_have_attribute("data-value", "0.0")


def test_lactate_split_and_ph_adjustment_annotation_render(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("unmeasured-ion")

    expect(page.locator('.partition-segment[data-component="SBE_lactate"]')).to_have_count(
        1, timeout=120_000
    )
    expect(page.locator('.partition-segment[data-component="SBE_UI_non_lactate"]')).to_have_count(1)
    expect(page.locator('.partition-segment[data-component="SBE_UI"]')).to_have_count(0)
    expect(page.locator("#sbe-total-marker")).to_have_attribute("data-value", "-18.0")
    expect(page.locator('[data-annotation="lactate-split"]')).to_contain_text("Lactate is split")
    expect(page.locator('[data-annotation="sid-reference-adjusted"]')).to_contain_text(
        "35 + 15 * (7.40 - pH)"
    )
    expect(page.locator('[data-annotation="sid-reference-adjusted"]')).to_contain_text(
        "value used: 37.7 mmol/L"
    )


def test_offset_and_chronic_hypercapnia_visual_annotations(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("masked")
    expect(page.locator('[data-annotation="offset"]')).to_contain_text(
        "components do not cancel to normal"
    )

    page.locator("#example-select").select_option("chronic-hypercapnia")
    expect(page.locator("#comparison-caution")).to_contain_text("chronic hypercapnia")
    expect(page.locator('[data-annotation="chronic-hypercapnia"]')).to_contain_text(
        "renal chloride loss"
    )


def test_hypoalbuminemic_example_renders_albumin_component(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("hypoalbuminemic")

    expect(page.locator("#headline-card")).to_contain_text(
        "Stewart Light suggests", timeout=120_000
    )
    expect(page.locator('.partition-segment[data-component="SBE_Alb"]')).to_have_attribute(
        "data-value", "6.0"
    )
    expect(page.locator("#teaching-diagram")).to_contain_text("Weak acids")


def test_base_excess_explanation_and_mini_schematics(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    fill_valid_case(page)
    submit_and_wait(page)

    expect(page.locator("#base-excess-card")).to_contain_text("Example Metabolic Processes")
    expect(page.locator("#base-excess-card")).to_contain_text(
        "fixed teaching examples, not values calculated from the current inputs"
    )
    expect(page.locator("#base-excess-details")).to_have_count(0)
    expect(page.locator("#base-excess-card")).to_contain_text(
        "A normal total does not guarantee a simple process"
    )
    expect(page.locator(".mini-schematic")).to_have_count(3)
    expect(page.locator('[data-mini-example="offset"]')).to_be_visible()


def test_advanced_bedside_toggle_and_phosphate_flow(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    fill_valid_case(page)
    page.locator("#phosphate").fill("1.2")
    expect(page.locator("#toggle-advanced")).to_be_checked()
    expect(page.locator("#advanced-bedside-card")).to_be_hidden()
    submit_and_wait(page)

    expect(page.locator("#advanced-bedside-card")).to_be_visible()
    expect(page.locator("#advanced-bedside-card")).to_contain_text(
        "Decomposition with physicochemical approach"
    )
    expect(page.locator("#advanced-bedside-card")).not_to_contain_text("Supplementary")
    expect(page.locator("#advanced-bedside-details")).to_contain_text("Phosphate effect")
    expect(page.locator("#advanced-bedside-details")).not_to_contain_text("Not provided")
    expect(page.locator("#normalized-details")).to_contain_text("1.2 mmol/L")


def test_compensation_map_toggle_renders_patient_and_guides(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    fill_valid_case(page)
    expect(page.locator("#compensation-map-card")).to_be_hidden()
    page.locator("#toggle-compensation-map").check()
    submit_and_wait(page)

    expect(page.locator("#compensation-map-card")).to_be_visible()
    expect(page.locator("#compensation-map-title")).to_have_text("Boston compensation map")
    expect(page.locator("#compensation-patient-point")).to_have_attribute("data-pco2", "25.0")
    expect(page.locator("#compensation-patient-point")).to_have_attribute("data-sbe", "-18.0")
    expect(page.locator('.map-guide[data-guide="chronic-respiratory"]')).to_have_count(1)
    expect(page.locator("#compensation-map-note")).to_contain_text("Boston-rule compensation")
    sbe_axis_label = page.locator(".compensation-map-svg .axis-unit").filter(has_text="SBE")
    expect(sbe_axis_label).to_be_visible()
    label_box = sbe_axis_label.bounding_box()
    svg_box = page.locator(".compensation-map-svg").bounding_box()
    assert label_box is not None
    assert svg_box is not None
    assert label_box["y"] >= svg_box["y"]


def test_ag_followup_toxicology_caveat_lab_caveats_and_hydrogen_chip(
    app_url: str, page: Page
) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("unmeasured-ion")

    expect(page.locator("#anion-gap-details")).to_contain_text("clearly elevated")
    expect(page.locator("#follow-up-card")).to_be_visible()
    expect(page.locator("#follow-up-prompts")).to_contain_text("toxic alcohols")
    expect(page.locator("#toxicology-caveat")).to_contain_text(
        "does not reliably exclude toxic alcohol exposure"
    )
    expect(page.locator("#hydrogen-chip")).to_contain_text("pH 7.22")
    expect(page.locator("#lab-caveats-card")).to_contain_text("same timepoint")


def test_calculation_does_not_persist_inputs_to_url_or_browser_storage(
    app_url: str, page: Page
) -> None:
    open_ready_app(app_url, page)

    page.locator("#example-select").select_option("unmeasured-ion")
    expect(page.locator("#headline-card")).to_contain_text(
        "Stewart Light suggests", timeout=120_000
    )

    assert page.evaluate("window.location.search") == ""
    assert page.evaluate("window.location.hash") == ""
    assert page.evaluate("window.localStorage.length") == 0
    assert page.evaluate("window.sessionStorage.length") == 0


def test_chronic_hypercapnia_excess_sid_overlay(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#ph").fill("7.37")
    page.locator("#pco2").fill("60")
    page.locator("#hco3").fill("32")
    page.locator("#sbe").fill("12")
    page.locator("#sodium").fill("152")
    page.locator("#chloride").fill("101")
    page.locator("#albumin").fill("40")
    page.locator("#chronic-hypercapnia").check()
    submit_and_wait(page)

    expect(page.locator("#comparison-caution")).to_contain_text(
        "exceeds what chronic hypercapnia alone would usually explain"
    )
    expect(page.locator('[data-annotation="chronic-hypercapnia"]')).to_contain_text(
        "renal chloride loss"
    )


def test_hypoalbuminemia_masking_gap_signal(app_url: str, page: Page) -> None:
    open_ready_app(app_url, page)

    page.locator("#ph").fill("7.40")
    page.locator("#pco2").fill("40")
    page.locator("#hco3").fill("24")
    page.locator("#sbe").fill("-8")
    page.locator("#sodium").fill("140")
    page.locator("#chloride").fill("112")
    page.locator("#albumin").fill("20")
    submit_and_wait(page)

    expect(page.locator("#anion-gap-details")).to_contain_text("not elevated")
    expect(page.locator("#anion-gap-notes")).to_contain_text("Hypoalbuminemia may mask")
    expect(page.locator("#follow-up-card")).to_be_visible()


@pytest.mark.parametrize(
    "viewport",
    [
        {"width": 360, "height": 780},
        {"width": 768, "height": 900},
        {"width": 1280, "height": 900},
    ],
)
def test_visuals_are_responsive_without_document_overflow(
    app_url: str, page: Page, viewport: dict[str, int]
) -> None:
    page.set_viewport_size(viewport)
    open_ready_app(app_url, page)

    page.locator("#toggle-advanced").check()
    page.locator("#toggle-compensation-map").check()
    page.locator("#example-select").select_option("masked")
    expect(page.locator(".partition-svg")).to_be_visible(timeout=120_000)
    expect(page.locator(".teaching-svg")).to_be_visible()
    expect(page.locator("#advanced-bedside-card")).to_be_visible()
    expect(page.locator("#compensation-map-card")).to_be_visible()

    assert page.evaluate(
        "document.documentElement.scrollWidth <= document.documentElement.clientWidth"
    )
    assert (
        page.locator(".partition-segment-label").count()
        == page.locator(".partition-segment").count()
    )

    for selector in [".partition-svg", ".teaching-svg"]:
        box = page.locator(selector).bounding_box()
        assert box is not None
        assert box["width"] >= min(300, viewport["width"] - 80)
        assert box["height"] >= 120
