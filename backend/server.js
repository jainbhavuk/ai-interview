import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  generateInterviewStructure,
  evaluateAnswer,
  handleUserResponse,
  generateFinalReport,
} from "./services/interviewAI.js";

const app = express();
const PORT = process.env.PORT || 5555;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

app.post("/api/generate", async (req, res) => {
  try {
    const result = await generateInterviewStructure(req.body);
    res.json(result);
  } catch (error) {
    console.error("Generate error:", error);
    res.status(500).json({ error: "Failed to generate interview structure" });
  }
});

app.post("/api/evaluate", async (req, res) => {
  try {
    const { question, answer, conversationHistory } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: "Question and answer required" });
    }
    const result = await evaluateAnswer(question, answer, conversationHistory);
    res.json(result);
  } catch (error) {
    console.error("Evaluate error:", error);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
});

app.post("/api/respond", async (req, res) => {
  try {
    const { input, currentQuestion, yoe, context } = req.body;
    if (!input) {
      return res.status(400).json({ error: "Input required" });
    }
    const result = await handleUserResponse(
      input,
      currentQuestion,
      yoe,
      context,
    );
    res.json(result);
  } catch (error) {
    console.error("Respond error:", error);
    res.status(500).json({ error: "Failed to handle response" });
  }
});

app.post("/api/report", async (req, res) => {
  try {
    const { transcript, config } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "Transcript required" });
    }
    const result = await generateFinalReport(transcript, config);
    res.json(result);
  } catch (error) {
    console.error("Report error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((error, req, res) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
