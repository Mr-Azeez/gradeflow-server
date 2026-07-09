"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFeedbackNotification = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: process.env.FEEDBACK_EMAIL_USER,
        pass: process.env.FEEDBACK_EMAIL_APP_PASSWORD,
    },
});
const sendFeedbackNotification = async (params) => {
    const { message, pageContext, userId } = params;
    try {
        await transporter.sendMail({
            from: `"GradeFlow Feedback" <${process.env.FEEDBACK_EMAIL_USER}>`,
            to: process.env.FEEDBACK_EMAIL_USER,
            subject: "New GradeFlow Feedback",
            text: [
                `New feedback received:`,
                ``,
                message,
                ``,
                `Page: ${pageContext ?? "unknown"}`,
                `User ID: ${userId}`,
                `Time: ${new Date().toISOString()}`,
            ].join("\n"),
        });
    }
    catch (err) {
        console.error("Failed to send feedback notification email:", err);
    }
};
exports.sendFeedbackNotification = sendFeedbackNotification;
