import { NextRequest, NextResponse } from 'next/server';
import { processChat } from '@/lib/ai/chat-engine';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const sid = sessionId || uuidv4();

    const result = await processChat(message, sid);

    return NextResponse.json({
      message: result.response,
      sessionId: result.sessionId,
      metadata: result.metadata || null,
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your message. Please try again.' },
      { status: 500 }
    );
  }
}
