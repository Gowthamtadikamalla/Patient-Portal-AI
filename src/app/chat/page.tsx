'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    type?: string;
    data?: unknown;
  };
}

interface SlotData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string;
  display: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, sessionId }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      const aiMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        metadata: data.metadata || undefined,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch {
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'I apologize, but I encountered a connection issue. Please try again in a moment.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSlotSelect = async (slot: SlotData) => {
    await sendMessage(`I'd like to book the ${slot.display} slot please.`);
  };

  const initiateVoiceCall = async () => {
    if (!phoneNumber) return;
    setCallStatus('connecting');

    try {
      const response = await fetch('/api/voice/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, phoneNumber }),
      });

      const data = await response.json();

      if (data.success || data.demo) {
        setCallStatus('active');
        const statusMsg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: data.demo
            ? `📞 **Voice Handoff Demo Mode**\n\n${data.message}\n\nIn a configured environment, you would receive a phone call at ${phoneNumber} from Kyra, our AI assistant, who would continue this conversation seamlessly.`
            : `📞 **Phone call initiated!**\n\nYou should receive a call at ${phoneNumber} shortly. Kyra will continue our conversation from where we left off.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, statusMsg]);
        setTimeout(() => {
          setShowVoiceModal(false);
          setCallStatus('idle');
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to initiate call');
      }
    } catch (err) {
      setCallStatus('idle');
      alert('Failed to initiate voice call. Please try again. Error: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="chat-container">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <Link href="/">← Back</Link>
          <div className="chat-header-info">
            <div className="chat-avatar">🤖</div>
            <div>
              <div className="chat-name">Kyra</div>
              <div className="chat-status">
                <span className="status-dot" />
                Online
              </div>
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          <button
            className="voice-btn"
            onClick={() => setShowVoiceModal(true)}
            id="voice-handoff-btn"
          >
            <span className="voice-pulse" />
            📞 Continue on Phone
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" id="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Welcome to Kyron Medical 👋</h2>
            <p>How can I help you today? You can ask me about:</p>
            <div className="quick-actions">
              <button
                className="quick-action-btn"
                onClick={() => sendMessage('I need to schedule an appointment')}
              >
                📅 Schedule Appointment
              </button>
              <button
                className="quick-action-btn"
                onClick={() => sendMessage('I want to check on a prescription refill')}
              >
                💊 Prescription Refill
              </button>
              <button
                className="quick-action-btn"
                onClick={() => sendMessage('What are your office hours and locations?')}
              >
                🏢 Office Hours & Locations
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'assistant' ? '🤖' : '👤'}
            </div>
            <div>
              <div className="message-bubble">
                {msg.content}

                {/* Slot picker */}
                {msg.metadata?.type === 'slot_picker' && (
                  <div className="slot-picker">
                    {((msg.metadata.data as { slots: SlotData[] })?.slots || []).map((slot: SlotData) => (
                      <button
                        key={slot.id}
                        className="slot-btn"
                        onClick={() => handleSlotSelect(slot)}
                      >
                        <span className="slot-icon">📅</span>
                        {slot.display}
                      </button>
                    ))}
                  </div>
                )}

                {/* Confirmation card */}
                {msg.metadata?.type === 'confirmation' && (() => {
                  const appt = msg.metadata.data as {
                    doctor: string;
                    specialty: string;
                    date: string;
                    time: string;
                    dayOfWeek: string;
                    office: string;
                    officePhone: string;
                  };
                  return (
                    <div className="confirmation-card">
                      <h4>✅ Appointment Confirmed</h4>
                      <div className="confirmation-detail">
                        <span className="confirmation-label">Doctor</span>
                        <span className="confirmation-value">{appt?.doctor}</span>
                      </div>
                      <div className="confirmation-detail">
                        <span className="confirmation-label">Specialty</span>
                        <span className="confirmation-value">{appt?.specialty}</span>
                      </div>
                      <div className="confirmation-detail">
                        <span className="confirmation-label">Date</span>
                        <span className="confirmation-value">{appt?.dayOfWeek}, {appt?.date}</span>
                      </div>
                      <div className="confirmation-detail">
                        <span className="confirmation-label">Time</span>
                        <span className="confirmation-value">{appt?.time}</span>
                      </div>
                      <div className="confirmation-detail">
                        <span className="confirmation-label">Location</span>
                        <span className="confirmation-value" style={{ whiteSpace: 'pre-line' }}>{appt?.office}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="message-time">{formatTime(msg.timestamp)}</div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="message message-assistant">
            <div className="message-avatar" style={{
              background: 'linear-gradient(135deg, var(--kyron-accent), var(--kyron-accent-2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%', fontSize: 14
            }}>
              🤖
            </div>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            disabled={isLoading}
            id="chat-input"
          />
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            id="send-btn"
          >
            ↑
          </button>
        </div>
      </div>

      {/* Voice Call Modal */}
      {showVoiceModal && (
        <div className="modal-overlay" onClick={() => callStatus === 'idle' && setShowVoiceModal(false)}>
          <div className="glass-panel modal-content" onClick={(e) => e.stopPropagation()}>
            {callStatus === 'idle' ? (
              <>
                <h2>📞 Continue on Phone</h2>
                <p>
                  Enter your phone number and Kyra will call you to continue this conversation.
                  All context from our chat will be transferred seamlessly.
                </p>
                <input
                  className="modal-input"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  id="phone-input"
                />
                <div className="modal-actions">
                  <button
                    className="modal-btn-secondary"
                    onClick={() => setShowVoiceModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-btn-primary"
                    onClick={initiateVoiceCall}
                    disabled={!phoneNumber}
                    id="call-btn"
                  >
                    Call Me Now
                  </button>
                </div>
              </>
            ) : callStatus === 'connecting' ? (
              <>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <h2>Connecting...</h2>
                <p>Setting up your voice call. Please wait a moment.</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h2>Call Initiated!</h2>
                <p>You should receive a call shortly at {phoneNumber}.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
