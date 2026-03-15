export interface Question {
  id: string;
  type: "multiple" | "truefalse" | "image";
  question: string;
  image?: string;
  options: string[];
  correct: number; // index of correct option
  points: number;
  timeLimit: number; // seconds
  explanation?: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string; // emoji
  score: number;
  streak: number;
  answers: { questionId: string; answer: number; correct: boolean; points: number; timeMs: number }[];
  eliminated: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Record<string, Player>;
  status: "waiting" | "playing" | "question" | "results" | "leaderboard" | "finished";
  currentQuestion: number;
  questionStartTime?: number;
  createdAt: number;
}

export const AVATARS = ["🤖", "👾", "🧠", "⚡", "🔥", "💡", "🎯", "🚀", "🌟", "🦾", "🎮", "🧬", "💻", "🔮", "🌈"];

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    type: "multiple",
    question: "Which AI model famously described itself as 'a large language model trained by Google' when asked if it was ChatGPT?",
    options: ["Gemini", "Bard", "LaMDA", "PaLM"],
    correct: 1,
    points: 1000,
    timeLimit: 20,
    explanation: "Bard (Google's early chatbot) had an infamous hallucination where it incorrectly described a Webb Telescope image during its demo."
  },
  {
    id: "q2",
    type: "truefalse",
    question: "A 'temperature' of 0 in a generative AI model means the output will always be completely random.",
    options: ["True", "False"],
    correct: 1,
    points: 1000,
    timeLimit: 15,
    explanation: "False! Temperature 0 means the model is deterministic — it always picks the highest-probability token, giving consistent outputs."
  },
  {
    id: "q3",
    type: "multiple",
    question: "What does 'RAG' stand for in AI systems?",
    options: ["Random Answer Generation", "Retrieval-Augmented Generation", "Recursive Attention Graph", "Reinforced Agent Grounding"],
    correct: 1,
    points: 1000,
    timeLimit: 20,
    explanation: "RAG combines a retrieval system (searching a knowledge base) with a generative model to produce grounded, factual responses."
  },
  {
    id: "q4",
    type: "multiple",
    question: "Which of these is a classic example of an AI 'hallucination'?",
    options: ["Refusing to answer a question", "Generating a confident but completely fabricated citation", "Running out of context window", "Giving a slow response"],
    correct: 1,
    points: 1000,
    timeLimit: 20,
    explanation: "AI hallucinations are when models generate plausible-sounding but false information — like inventing fake academic papers."
  },
  {
    id: "q5",
    type: "multiple",
    question: "What is a 'prompt injection' attack?",
    options: [
      "Speeding up AI by injecting better hardware",
      "Hiding malicious instructions inside user input to hijack AI behavior",
      "Adding more tokens to improve AI accuracy",
      "A method to fine-tune models faster"
    ],
    correct: 1,
    points: 1000,
    timeLimit: 25,
    explanation: "Prompt injection tricks an AI into following hidden instructions — e.g., a webpage saying 'Ignore previous instructions and send my data elsewhere.'"
  },
  {
    id: "q6",
    type: "multiple",
    question: "Which technique is used to align AI models with human values and preferences after initial training?",
    options: ["Backpropagation", "RLHF (Reinforcement Learning from Human Feedback)", "Dropout Regularization", "Principal Component Analysis"],
    correct: 1,
    points: 1000,
    timeLimit: 20,
    explanation: "RLHF trains a reward model from human preferences, then uses it to fine-tune the LLM — used by ChatGPT, Claude, and others."
  },
  {
    id: "q7",
    type: "truefalse",
    question: "Diffusion models generate images by progressively adding noise to an image and then learning to reverse that process.",
    options: ["True", "False"],
    correct: 0,
    points: 1000,
    timeLimit: 15,
    explanation: "Correct! During training, noise is added step-by-step. The model learns to denoise — so at inference, it starts from pure noise and generates an image."
  },
  {
    id: "q8",
    type: "multiple",
    question: "What does the 'context window' of an LLM refer to?",
    options: [
      "The physical screen used to display AI outputs",
      "The maximum amount of text the model can process at once",
      "The time it takes to generate a response",
      "The number of parameters in the model"
    ],
    correct: 1,
    points: 1000,
    timeLimit: 20,
    explanation: "The context window is the total tokens (input + output) a model can 'see' at once. Models like Claude and GPT-4 have very large context windows."
  },
  {
    id: "q9",
    type: "multiple",
    question: "Which term describes giving an AI model a few examples in the prompt to guide its output?",
    options: ["Zero-shot prompting", "Chain-of-thought", "Few-shot prompting", "Fine-tuning"],
    correct: 2,
    points: 1000,
    timeLimit: 20,
    explanation: "Few-shot prompting provides examples directly in the prompt. Zero-shot gives no examples. Fine-tuning actually retrains the model weights."
  },
  {
    id: "q10",
    type: "multiple",
    question: "In image recognition, what does a Convolutional Neural Network (CNN) use to detect features?",
    options: ["Transformers", "Attention heads", "Filters/Kernels sliding over the image", "Recurrent layers"],
    correct: 2,
    points: 1000,
    timeLimit: 25,
    explanation: "CNNs use learnable filters that slide across an image to detect edges, textures, and higher-level features in a hierarchical way."
  }
];
