import { NextResponse } from 'next/server';

// Mock data - replace with actual database calls
export async function GET() {
  const mockStreams = [
    {
      id: '1',
      title: 'Live Gaming Session',
      status: 'live',
      startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      endTime: null,
      channel: 'GamerPro',
      viewers: 1250
    },
    {
      id: '2',
      title: 'Coding Tutorial',
      status: 'upcoming',
      startTime: new Date(Date.now() + 3600000).toISOString(), // In 1 hour
      endTime: null,
      channel: 'CodeMaster',
      viewers: 0
    },
    {
      id: '3',
      title: 'Music Performance',
      status: 'ended',
      startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      endTime: new Date(Date.now() - 82800000).toISOString(), // 1 hour after start
      channel: 'MusicLover',
      viewers: 0
    }
  ];

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return NextResponse.json(mockStreams);
}
