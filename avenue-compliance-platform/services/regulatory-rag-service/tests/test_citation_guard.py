from src.citation_guard import guard


def test_clean_response_with_citations_passes():
    text = (
        "The rule requires written supervisory procedures [FINRA 3110(b)(1)]. "
        "It mandates retention for at least three years [SEC 17 CFR 240.17a-4(e)].\n"
        "CITATIONS: FINRA 3110(b)(1), 17 CFR 240.17a-4(e)"
    )
    allowed = {"FINRA 3110(b)(1)", "SEC 17 CFR 240.17a-4(e)"}
    result = guard(text, allowed)
    assert result.accepted, result.reasons


def test_legal_advice_phrasing_blocked():
    text = "You should file a SAR [FINRA 3310]."
    result = guard(text, {"FINRA 3310"})
    assert not result.accepted
    assert any("forbidden_phrasing" in r for r in result.reasons)


def test_hallucinated_citation_blocked():
    text = "The rule mandates X [FINRA 9999(z)]."
    result = guard(text, {"FINRA 3310"})
    assert not result.accepted
    assert any("hallucinated_citations" in r for r in result.reasons)


def test_assertion_without_citation_blocked():
    text = "The rule requires written procedures."
    result = guard(text, {"FINRA 3110"})
    assert not result.accepted
    assert any("missing_citation_in" in r for r in result.reasons)


def test_bullet_list_assertion_without_citation_blocked():
    # Round 2 fix: previously the lexer skipped bullets entirely, so
    # uncited assertions inside lists were accepted.
    text = "- The rule requires written procedures."
    result = guard(text, {"FINRA 3110"})
    assert not result.accepted
    assert any("missing_citation_in" in r for r in result.reasons)
