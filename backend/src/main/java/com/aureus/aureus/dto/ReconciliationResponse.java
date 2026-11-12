package com.aureus.aureus.dto;

import java.time.LocalDateTime;
import java.util.List;

public class ReconciliationResponse {

    private String status;
    private LocalDateTime checkedAt;
    private List<ReconciliationCheck> checks;

    public ReconciliationResponse(
            String status,
            LocalDateTime checkedAt,
            List<ReconciliationCheck> checks) {
        this.status = status;
        this.checkedAt = checkedAt;
        this.checks = List.copyOf(checks);
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getCheckedAt() {
        return checkedAt;
    }

    public List<ReconciliationCheck> getChecks() {
        return checks;
    }
}