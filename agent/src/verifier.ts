import OpenAI from "openai";
import { ipfsToHttpGateway, fetchIpfsJson } from "./ipfs.js";
import { readPreviousDeliverable } from "./contract-reads.js";
import { type VerifyResult, type VerificationScores } from "./types.js";

const openai = new OpenAI();

function buildFraudPrompt(task: { description: string; proofRequirements: string }) {
  return `You are an image forensics expert. Analyze the submitted image(s) for signs of fraud or gaming. The worker may have submitted multiple images as proof — evaluate ALL of them together.

IMPORTANT CONTEXT — The worker was hired to do the following task:
**Task:** ${task.description}
**Required proof:** ${task.proofRequirements}

If the task itself requires screenshots, stock images, browser content, or similar elements,
do NOT flag those as fraud. Only flag things that are suspicious GIVEN what the task asked for.
For example, if the task says "take a screenshot of a website", browser chrome is expected, not fraud.

Check for the following (only flag items that are genuinely suspicious given the task context):
1. AI-GENERATED CONTENT: DALL-E/Midjourney/SD artifacts -- unnatural smoothness, warped text, impossible geometry, six fingers, inconsistent lighting/shadows, repeating patterns.
2. STOCK PHOTOS: Watermarks, overly polished studio lighting, generic staged compositions -- BUT only if the task did NOT ask the worker to find/use stock images.
3. SCREENSHOTS OF OTHER WORK: Browser chrome, cursor artifacts, screen recording indicators -- BUT only if the task did NOT ask for screenshots or browser-based proof.
4. RECYCLED/IRRELEVANT IMAGES: Image clearly predates the task, shows content unrelated to the described work, is a meme or random photo.
5. MANIPULATED IMAGES: Obvious Photoshop artifacts, cloned regions, inconsistent resolution between foreground/background, JPEG artifacts around edited areas.
6. SUSPICIOUS METADATA INDICATORS: Image is suspiciously low resolution (<400px), is a tiny thumbnail, or appears to be a photo of a screen (unless a screenshot was requested).

Respond as JSON:
{
  "authenticity_score": 0.0-1.0,
  "fraud_flags": ["list of specific concerns, empty if none"],
  "reasoning": "detailed analysis of what you observed"
}`;
}

function buildRequirementsPrompt(task: { description: string; proofRequirements: string }) {
  return `You are a strict quality inspector. A worker was hired to complete a task and submitted image(s) as proof. The worker may have submitted multiple images — evaluate ALL of them together as a combined proof submission.

**Task they were hired for:** ${task.description}
**Proof requirements they must meet:** ${task.proofRequirements}

Score this submission on three dimensions. Be strict -- real money is being paid based on your assessment.

For each dimension, provide a score AND specific evidence from the image:

1. RELEVANCE (0.0-1.0): Does this image actually show the work described in the task? A photo of a sunset does not prove someone designed a flyer. Score 0.0 if the image has nothing to do with the task.

2. COMPLETENESS (0.0-1.0): Does the proof meet ALL requirements listed above? Go through each requirement one by one. If the requirements say "10 different locations" and you see 3, score proportionally. If a specific element is required (product name, QR code, etc.) and it's missing, deduct heavily.

3. QUALITY (0.0-1.0): Is the work professional and usable? For design tasks: is it print-ready, well-composed, free of typos? For physical tasks: are photos clear and well-lit? Score 0.0 for blurry, unreadable, or obviously rushed work.

Respond as JSON:
{
  "relevance_score": 0.0-1.0,
  "relevance_evidence": "what in the image proves/disproves relevance",
  "completeness_score": 0.0-1.0,
  "completeness_evidence": "requirement-by-requirement check",
  "quality_score": 0.0-1.0,
  "quality_evidence": "specific quality observations",
  "overall_reasoning": "summary judgment"
}`;
}

function buildCrossVerifyPrompt(task: { description: string }, previousDeliverableUrl: string) {
  return `You are verifying consistency between two sequential tasks in a project.

**Current task:** ${task.description}
**The current worker was given this deliverable from the previous task and told to use it:** ${previousDeliverableUrl}

You will see TWO images:
- Image 1: The previous task's approved deliverable (the input this worker received)
- Image 2: The current worker's proof submission

Verify:
1. Does the current proof clearly USE or REFERENCE the previous deliverable? (e.g., if the previous task produced a flyer design, does the current proof show THAT SPECIFIC flyer printed and posted -- not a different design?)
2. Are there identifiable elements (logos, text, colors, layout) that match between the two?
3. Could the worker have ignored the previous deliverable and done something unrelated?

Respond as JSON:
{
  "consistency_score": 0.0-1.0,
  "matching_elements": ["list of specific elements that match between the two images"],
  "mismatches": ["list of concerning differences"],
  "reasoning": "detailed analysis"
}`;
}

export async function verifyProof(task: any, proofURI: string): Promise<VerifyResult> {
  if (process.env.MOCK_OPENAI === "true") {
    return {
      approved: true,
      confidence: 0.92,
      scores: { authenticity: 0.95, relevance: 0.90, completeness: 0.88, quality: 0.85, consistency: 1.0 },
      reasoning: "Mock verification — auto-approved",
      suggestion: "",
    };
  }

  const proofHttpUrl = ipfsToHttpGateway(proofURI);

  if (!proofHttpUrl || proofHttpUrl.includes("undefined") || !proofHttpUrl.startsWith("http")) {
    return {
      approved: false,
      confidence: 0,
      scores: { authenticity: 0, relevance: 0, completeness: 0, quality: 0, consistency: 0 },
      reasoning: `Invalid proof URI: "${proofURI}". The worker's upload likely failed.`,
      suggestion: "Worker submitted an invalid proof URI. Please re-upload a valid image.",
    };
  }

  // Resolve image URLs — could be a single image or a JSON manifest with multiple images
  let imageUrls: string[];
  try {
    const maybeManifest = await fetchIpfsJson(proofURI) as any;
    if (maybeManifest && Array.isArray(maybeManifest.images) && maybeManifest.images.length > 0) {
      imageUrls = maybeManifest.images.map((uri: string) => ipfsToHttpGateway(uri));
      console.log(`Manifest detected: ${imageUrls.length} images`);
    } else {
      // Parsed as JSON but no images array — treat as single image
      imageUrls = [proofHttpUrl];
    }
  } catch {
    // Not JSON — treat as a direct image URL
    imageUrls = [proofHttpUrl];
  }

  const prevDeliverableUri = await readPreviousDeliverable(task.jobId, task.id);
  const prevDeliverableUrl = prevDeliverableUri ? ipfsToHttpGateway(prevDeliverableUri) : null;

  const [fraudResult, requirementsResult] = await Promise.all([
    runFraudDetection(imageUrls, task),
    runRequirementsCheck(imageUrls, task),
  ]);

  let consistencyScore = 1.0;
  let crossVerifyResult: any = null;
  if (prevDeliverableUrl) {
    crossVerifyResult = await runCrossVerification(imageUrls, prevDeliverableUrl, task);
    consistencyScore = crossVerifyResult.consistency_score;
  }

  const scores: VerificationScores = {
    authenticity: fraudResult.authenticity_score,
    relevance: requirementsResult.relevance_score,
    completeness: requirementsResult.completeness_score,
    quality: requirementsResult.quality_score,
    consistency: consistencyScore,
  };

  const confidence =
    scores.authenticity * 0.30 +
    scores.relevance * 0.25 +
    scores.completeness * 0.25 +
    scores.quality * 0.10 +
    scores.consistency * 0.10;

  const allAboveFloor = Object.values(scores).every(s => s >= 0.6);
  const fraudKillSwitch = scores.authenticity < 0.5;
  const approved = !fraudKillSwitch && allAboveFloor && confidence >= 0.75;

  let suggestion = "";
  if (!approved) {
    const issues: string[] = [];
    if (fraudKillSwitch) issues.push(`Fraud detected: ${fraudResult.fraud_flags.join(", ")}`);
    if (scores.relevance < 0.6) issues.push(`Image doesn't appear related to the task`);
    if (scores.completeness < 0.6) issues.push(`Missing requirements: ${requirementsResult.completeness_evidence}`);
    if (scores.quality < 0.6) issues.push(`Quality too low: ${requirementsResult.quality_evidence}`);
    if (scores.consistency < 0.6) issues.push(`Doesn't match previous deliverable: ${crossVerifyResult?.mismatches?.join(", ")}`);
    if (confidence < 0.75 && issues.length === 0) issues.push(`Overall confidence too low (${(confidence * 100).toFixed(0)}%). Please submit clearer proof.`);
    suggestion = issues.join(" | ");
  }

  return {
    approved,
    confidence,
    scores,
    reasoning: [
      `Fraud: ${fraudResult.reasoning}`,
      `Requirements: ${requirementsResult.overall_reasoning}`,
      crossVerifyResult ? `Cross-verify: ${crossVerifyResult.reasoning}` : null,
    ].filter(Boolean).join("\n\n"),
    suggestion,
  };
}

async function runFraudDetection(imageUrls: string[], task: { description: string; proofRequirements: string }) {
  try {
    const content: any[] = [{ type: "text", text: buildFraudPrompt(task) }];
    for (const url of imageUrls) {
      content.push({ type: "image_url", image_url: { url } });
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content!);
  } catch (err) {
    console.error("Fraud detection pass failed:", err);
    return { authenticity_score: 0.5, fraud_flags: ["fraud detection unavailable"], reasoning: "Error in fraud detection" };
  }
}

async function runRequirementsCheck(imageUrls: string[], task: any) {
  try {
    const content: any[] = [{ type: "text", text: buildRequirementsPrompt(task) }];
    for (const url of imageUrls) {
      content.push({ type: "image_url", image_url: { url } });
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content!);
  } catch (err) {
    console.error("Requirements check pass failed:", err);
    return { relevance_score: 0, completeness_score: 0, quality_score: 0,
      relevance_evidence: "error", completeness_evidence: "error",
      quality_evidence: "error", overall_reasoning: "Requirements check failed" };
  }
}

async function runCrossVerification(currentImageUrls: string[], previousImageUrl: string, task: any) {
  try {
    const content: any[] = [
      { type: "text", text: buildCrossVerifyPrompt(task, previousImageUrl) },
      { type: "image_url", image_url: { url: previousImageUrl } },
    ];
    for (const url of currentImageUrls) {
      content.push({ type: "image_url", image_url: { url } });
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content!);
  } catch (err) {
    console.error("Cross-verification pass failed:", err);
    return { consistency_score: 0.5, matching_elements: [], mismatches: ["cross-verification unavailable"], reasoning: "Error" };
  }
}
