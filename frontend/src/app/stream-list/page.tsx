'use client';

import { useState, useEffect } from 'react';
import { Table, Container, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import Link from 'next/link';

type Stream = {
  id: string;
  title: string;
  status: 'live' | 'upcoming' | 'ended';
  startTime: string;
  endTime: string | null;
  channel: string;
  viewers: number;
};

export default function StreamListPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        // Replace with your actual API endpoint
        const response = await fetch('/api/streams');
        if (!response.ok) {
          throw new Error('Failed to fetch streams');
        }
        const data = await response.json();
        setStreams(data);
      } catch (err) {
        console.error('Error fetching streams:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStreams();
  }, []);

  const getStatusBadge = (status: Stream['status']) => {
    switch (status) {
      case 'live':
        return <Badge bg="danger">Live</Badge>;
      case 'upcoming':
        return <Badge bg="warning" text="dark">Upcoming</Badge>;
      case 'ended':
        return <Badge bg="secondary">Ended</Badge>;
      default:
        return <Badge bg="light" text="dark">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="my-4">
        <Alert variant="danger">
          Error loading streams: {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="my-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Stream List</h1>
        <Button variant="primary" href="/streams/new">
          Add New Stream
        </Button>
      </div>

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Status</th>
            <th>Title</th>
            <th>Channel</th>
            <th>Start Time</th>
            <th>End Time</th>
            <th>Viewers</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {streams.length > 0 ? (
            streams.map((stream) => (
              <tr key={stream.id}>
                <td>{getStatusBadge(stream.status)}</td>
                <td>
                  <Link href={`/streams/${stream.id}`} className="text-decoration-none">
                    {stream.title}
                  </Link>
                </td>
                <td>{stream.channel}</td>
                <td>{new Date(stream.startTime).toLocaleString()}</td>
                <td>{stream.endTime ? new Date(stream.endTime).toLocaleString() : '-'}</td>
                <td>{stream.viewers.toLocaleString()}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button variant="outline-primary" size="sm" href={`/streams/${stream.id}`}>
                      View
                    </Button>
                    <Button variant="outline-secondary" size="sm" href={`/streams/${stream.id}/edit`}>
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center">
                No streams found
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Container>
  );
}
