import { API_BASE } from '../../constants/api';

export async function generateInterviewStructure(config) {
  const response = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error('Failed to generate interview structure');
  return response.json();
}

export async function evaluateAnswer(question, answer, conversationHistory) {
  const response = await fetch(`${API_BASE}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, conversationHistory }),
  });
  if (!response.ok) throw new Error('Failed to evaluate answer');
  return response.json();
}

export async function handleUserResponse(input, currentQuestion, yoe, context) {
  const response = await fetch(`${API_BASE}/api/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, currentQuestion, yoe, context }),
  });
  if (!response.ok) throw new Error('Failed to handle response');
  return response.json();
}

export async function generateFinalReport(transcript, config) {
  const response = await fetch(`${API_BASE}/api/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, config }),
  });
  if (!response.ok) throw new Error('Failed to generate report');
  return response.json();
}
