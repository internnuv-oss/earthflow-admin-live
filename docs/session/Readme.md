# **Generating Test Scenarios & Test Cases**

## **Purpose**

Step-by-step instructions for generating **test scenarios** and **test cases** using Cursor Agent mode and the rule files in this folder.

---

## **A. WEB Admin Dashboard (React / Field Commander)**

### Rule to use every time

* `web_scenarios_rule.mdc` — single reusable prompt for frontend module scenarios

### Generate WEB scenarios

```
Follow @docs/session/web_scenarios_rule.mdc

## Target
- Module ID: <module-id>
- Output path: scenarios/web/<module-id>.md
- Overwrite if exists

## Sources (code only — primary)
@src/pages/<Module>Page.tsx
@src/components/<related>...

## Optional cross-check only (do NOT invent TCs from docs)
@docs/business-rules/<module-id>.md
```

Output: `scenarios/web/<module-id>.md` with `WEB-TC-*` cases traced only to frontend code.

---

## **B. GoLang APIs**

### **Step 1 — Rule Files**

* `scenarios_rule.mdc`
* `test_case_rule.mdc`
* `generic_test_case_rule.mdc` (multi-language test code generator)

### **Step 2 — Generate Test Scenarios**

```
follow @scenarios_rule.mdc and generate scenarios for @auth_controller.go
```

### **Step 3 — Generate Test Cases**

```
follow @auth_controller.md and generate test cases using @test_case_rule.mdc
```

---

## **Important Notes**

* Always **manually review** generated scenarios/TCs against real code.
* WEB rules: never invent validations/flows not present in the UI.
* Keep rule files updated as modules evolve.
