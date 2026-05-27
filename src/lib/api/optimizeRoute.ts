export interface BranchLocation {
  lat: number;
  lng: number;
}

export interface Order {
  id: string | number;
  lat: number;
  lng: number;
  [key: string]: any;
}

export interface OptimizeRoutePayload {
  batchId: string | number;
  branchLocation: BranchLocation;
  orders: Order[];
}

export async function optimizeBatchRoute(payload: OptimizeRoutePayload) {
  const response = await fetch('/api/optimize-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to optimize route');
  }

  return response.json();
}
