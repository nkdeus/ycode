import { NextRequest } from 'next/server';
import { createImport } from '@/lib/repositories/collectionImportRepository';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { noCache } from '@/lib/api-response';
import { getErrorMessage } from '@/lib/csv-utils';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/collections/[id]/import
 * Create a new CSV import job for a collection.
 * CSV data is NOT stored — it's sent per-batch to the process endpoint.
 *
 * Body:
 *  - columnMapping: Record<string, string> - Maps CSV column names to field IDs
 *  - totalRows: number - Total number of rows to import
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify collection exists
    const collection = await getCollectionById(id, false);
    if (!collection) {
      return noCache(
        { error: 'Collection not found' },
        404
      );
    }

    const body = await request.json();
    const { columnMapping, totalRows } = body;

    // Validate required fields
    if (!columnMapping || typeof columnMapping !== 'object') {
      return noCache(
        { error: 'Column mapping is required' },
        400
      );
    }

    if (!totalRows || typeof totalRows !== 'number' || totalRows <= 0) {
      return noCache(
        { error: 'totalRows is required and must be a positive number' },
        400
      );
    }

    // Create lightweight import job (CSV data is sent per-batch to the process endpoint)
    const importJob = await createImport({
      collection_id: id,
      column_mapping: columnMapping,
      total_rows: totalRows,
    });

    return noCache(
      { data: { importId: importJob.id } },
      201
    );
  } catch (error) {
    console.error('Error creating import job:', error);
    return noCache(
      { error: getErrorMessage(error) },
      500
    );
  }
}
