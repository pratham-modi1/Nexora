package com.aureus.aureus.dto;

import java.util.List;

public class ReconciliationCheck {

    private String name;
    private boolean passed;
    private String details;
    private List<String> offenders;

    public ReconciliationCheck(
            String name,
            boolean passed,
            String details,
            List<String> offenders) {
        this.name = name;
        this.passed = passed;
        this.details = details;
        this.offenders = List.copyOf(offenders);
    }

    public String getName() {
        return name;
    }

    public boolean isPassed() {
        return passed;
    }

    public String getDetails() {
        return details;
    }

    public List<String> getOffenders() {
        return offenders;
    }
}