"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Create report
router.post("/", auth_1.authenticateToken, async (req, res) => {
    try {
        const { target_id, target_type, reason, description } = req.body;
        if (!target_id || !target_type || !reason) {
            return res.status(400).json({
                success: false,
                error: "target_id, target_type, and reason are required",
            });
        }
        res.status(201).json({
            success: true,
            message: "Report submitted successfully",
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
// Get user's reports
router.get("/user", auth_1.authenticateToken, async (req, res) => {
    try {
        const { page, limit } = req.query;
        res.json({
            success: true,
            data: {
                reports: [],
                pagination: {
                    page: Number.parseInt(page) || 1,
                    limit: Number.parseInt(limit) || 20,
                    total: 0,
                    totalPages: 0
                }
            }
        });
    }
    catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message,
        });
    }
});
exports.default = router;
