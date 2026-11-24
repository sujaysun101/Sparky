import { Router, type IRouter } from "express";
import { z } from "zod";
import { query, uid } from "../lib/store";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FEEDBACK_RECIPIENT = "sujay9sundar@gmail.com";

const feedbackSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("Please enter a valid email address.").max(180),
  message: z.string().trim().min(3, "Please enter your feedback.").max(4000),
});

router.post("/feedback", async (req, res, next) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid feedback submission." });
      return;
    }

    const { name, email, message } = parsed.data;
    const id = uid();

    await query(
      "INSERT INTO feedback (id, name, email, message) VALUES ($1, $2, $3, $4)",
      [id, name || null, email, message],
    );

    let emailSent = false;
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.FEEDBACK_FROM_EMAIL || "Sparky Feedback <onboarding@resend.dev>",
            to: [FEEDBACK_RECIPIENT],
            reply_to: email,
            subject: `Sparky Feedback from ${name || email}`,
            text: `From: ${name ? `${name} <${email}>` : email}\nFeedback ID: ${id}\n\n${message}`,
          }),
        });
        emailSent = resp.ok;
        if (!resp.ok) {
          logger.warn({ status: resp.status }, "Resend feedback email delivery failed");
        }
      } catch (err) {
        logger.warn({ err }, "Resend feedback email request errored");
      }
    }

    res.status(201).json({
      ok: true,
      id,
      emailSent,
      recipient: FEEDBACK_RECIPIENT,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
