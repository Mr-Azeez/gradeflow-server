import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.FEEDBACK_EMAIL_USER,
    pass: process.env.FEEDBACK_EMAIL_APP_PASSWORD,
  },
});

export const sendFeedbackNotification = async (params: {
  message: string;
  pageContext: string | null;
  userId: string;
}) => {
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
  } catch (err) {
    console.error("Failed to send feedback notification email:", err);
  }
};
