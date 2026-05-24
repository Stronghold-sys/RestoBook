export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { history, systemPrompt, role } = await request.json();

        const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyBk_f3lrZ2U4gDpl43bl7WYp8hVUQpn4e4';
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        // Map history roles from 'assistant' to 'model' for Gemini API format
        const geminiHistory = history.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: geminiHistory,
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', errText);
            return NextResponse.json({ error: `API error: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, terjadi kesalahan. Silakan coba lagi.';

        return NextResponse.json({ reply });
    } catch (error) {
        console.error('RestoBot Proxy Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
