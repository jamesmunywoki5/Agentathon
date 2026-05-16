import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const parsePdf = require("pdf-parse");
import busboy from "busboy";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import fs from "fs";
import cron from "node-cron";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // --- API Routes ---

  // Upload and process Budget PDF
  app.post("/api/upload-budget", (req, res) => {
    const bb = busboy({ headers: req.headers });
    let pdfBuffer: Buffer[] = [];
    let ward = "";

    bb.on("file", (name, file, info) => {
      file.on("data", (data) => pdfBuffer.push(data));
    });

    bb.on("field", (name, val) => {
      if (name === "ward") ward = val;
    });

    bb.on("finish", async () => {
      try {
        const fullBuffer = Buffer.concat(pdfBuffer);
        
        // Extracting text page-by-page for more accurate metadata
        const pages: { text: string; pageNumber: number }[] = [];
        
        const options = {
          pagerender: (pageData: any) => {
            return pageData.getTextContent().then((textContent: any) => {
              let lastY, text = '';
              for (let item of textContent.items) {
                if (lastY != item.transform[5] || !lastY) {
                  text += '\n';
                }
                text += item.str;
                lastY = item.transform[5];
              }
              pages.push({
                text: text,
                pageNumber: pageData.pageIndex + 1
              });
              return text;
            });
          }
        };

        await parsePdf(fullBuffer, options);
        
        let totalChunks = 0;
        // Process each page and chunk if necessary
        for (const page of pages) {
          // Chunk pages larger than 4000 chars to keep context manageable
          const chunks = page.text.match(/[\s\S]{1,4000}/g) || [];
          for (const chunkText of chunks) {
            await addDoc(collection(db, "budgets"), {
              text: chunkText,
              pageNumber: page.pageNumber,
              ward: ward || "General",
              createdAt: serverTimestamp(),
            });
            totalChunks++;
          }
        }

        res.json({ message: `Successfully processed ${pages.length} pages into ${totalChunks} chunks.` });
      } catch (error) {
        console.error("PDF Processing Error:", error);
        res.status(500).json({ error: "Failed to process PDF." });
      }
    });

    req.pipe(bb);
  });

  // Chat with AI Agent
  app.post("/api/chat", async (req, res) => {
    const { question, ward } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required." });

    try {
      // 1. Retrieve context from Firestore
      const budgetsRef = collection(db, "budgets");
      let q = query(budgetsRef);
      if (ward) {
        q = query(budgetsRef, where("ward", "==", ward));
      }
      
      const snapshot = await getDocs(q);
      const context = snapshot.docs.map(doc => doc.data().text).join("\n\n").substring(0, 20000); // Increased context limit

      // 2. Generate response using Gemini
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        config: {
          systemInstruction: `You are a Ward Budget Liaison for a Kenyan county. 
          Your goal is to explain complex budget data to residents in plain, everyday language. 
          Avoid technical accounting terms like 'recurrent expenditure' or 'non-financial assets'. 
          Instead, say things like 'money for salaries and daily office needs' or 'physical items like furniture and buildings'.
          Focus on how the budget affects local schools, roads, and clinics in the specific ward.
          If users ask about a specific ward, prioritize context related to that ward.
          Be helpful, transparent, and concise.`,
        },
        contents: [
          { role: 'user', parts: [{ text: `Context: ${context}\n\nQuestion: ${question}` }] }
        ]
      });

      res.json({ answer: result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated." });
    } catch (error) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: "Agent is having trouble analyzing the budget right now." });
    }
  });

  // Subscribe for SMS (Mock)
  app.post("/api/subscribe", async (req, res) => {
    const { phoneNumber, ward } = req.body;
    try {
      await addDoc(collection(db, "subscribers"), {
        phoneNumber,
        ward,
        subscribedAt: serverTimestamp()
      });
      res.json({ message: "You have been subscribed to budget digests!" });
    } catch (error) {
      res.status(500).json({ error: "Failed to subscribe." });
    }
  });

  // Gazette Monitoring Mock
  app.get("/api/gazette-check", async (req, res) => {
    // In a real app, we'd scrape the treasury website
    // For now, we simulate finding an amendment
    const foundAmendment = Math.random() > 0.5;
    if (foundAmendment) {
      res.json({ 
        amendmentFound: true, 
        details: "New amendment noticed regarding Infrastructure Development Fund." 
      });
    } else {
      res.json({ amendmentFound: false });
    }
  });

  // --- Vite & Static Assets ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Scheduled task for gazette monitoring (Every day at 8 AM)
cron.schedule("0 8 * * *", async () => {
  console.log("Running scheduled Gazette amendment check...");
  // Logic to notify subscribers would go here
});

startServer();
