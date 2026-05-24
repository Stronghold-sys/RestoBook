export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { history, systemPrompt, role } = await request.json();

        const apiKey = process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Mistral API key not configured' }, { status: 500 });
        }

        const mistralMessages = [
            { role: 'system', content: systemPrompt },
            ...history.map((msg: any) => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }))
        ];

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'mistral-tiny',
                messages: mistralMessages,
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Mistral API error:', errText);
            return NextResponse.json({ error: `API error: ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        let reply = data.choices?.[0]?.message?.content || 'Maaf, terjadi kesalahan. Silakan coba lagi.';

        // Server-side sanitizer: strip all markdown formatting from Gemini response
        reply = reply
            .replace(/\*{3,}/g, '')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/__(.+?)__/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            .replace(/#{1,6}\s*/g, '')
            .replace(/^\s*[\*]\s+/gm, '- ')
            .replace(/\*/g, '')
            .trim();

        return NextResponse.json({ reply });
    } catch (error) {
        console.error('RestoBot Proxy Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
