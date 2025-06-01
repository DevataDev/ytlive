import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../src/auth';

export async function GET() {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    
    // Check if the user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // In a real app, you would fetch this data from your Go backend
    // and include the user's access token in the request
    const stats = {
      totalStreams: 42,
      activeStreams: 7,
      totalMirrors: 15,
      activeMonitors: 3,
      // Include user information for debugging
      userId: session.user.id,
      userEmail: session.user.email,
    };

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
