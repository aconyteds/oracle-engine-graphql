import type { CampaignAsset, RecordType } from "@prisma/client";
import type { Document } from "mongodb";
import type { AssetSearchResult } from "./assetSearch";

/**
 * Type definition for raw MongoDB BSON document returned from aggregateRaw.
 * MongoDB returns ObjectIds as { $oid: string } and Dates as { $date: string }.
 * This interface matches the exact structure from the Prisma schema.
 */
interface RawBSONAssetDocument {
  _id: { $oid: string };
  campaignId: { $oid: string };
  name: string;
  recordType: RecordType;
  gmSummary: string | null;
  gmNotes: string | null;
  playerSummary: string | null;
  playerNotes: string | null;
  createdAt: { $date: string };
  updatedAt: { $date: string };
  locationData: CampaignAsset["locationData"] | null;
  plotData: CampaignAsset["plotData"] | null;
  npcData: CampaignAsset["npcData"] | null;
  sessionEventLink: Array<{ $oid: string }>;
  score?: number;
}

/**
 * Converts a BSON ObjectId structure to a string.
 * @param oid - BSON ObjectId in format { $oid: "string" }
 * @returns The ObjectId as a string
 */
function convertObjectId(oid: { $oid: string }): string {
  return oid.$oid;
}

/**
 * Converts a BSON Date structure to a JavaScript Date.
 * @param date - BSON Date in format { $date: "ISO string" }
 * @returns JavaScript Date object
 */
function convertDate(date: { $date: string }): Date {
  return new Date(date.$date);
}

/**
 * Converts raw MongoDB BSON document from aggregateRaw to AssetSearchResult.
 * Explicitly handles known BSON types based on the Prisma schema definition.
 *
 * This function is intentionally NOT recursive - it only converts the specific
 * fields we know contain BSON types (ObjectIds and Dates). All other fields
 * are passed through unchanged.
 *
 * Fields requiring conversion:
 * - id, campaignId: ObjectId -> string
 * - createdAt, updatedAt: BSON Date -> JavaScript Date
 * - sessionEventLink: Array<ObjectId> -> string[]
 * - score: vectorScore/textScore/hybridScore -> unified score field
 *
 * Fields NOT requiring conversion (already correct types):
 * - name, recordType, gmSummary, gmNotes, playerSummary, playerNotes
 * - locationData (all string fields)
 * - npcData (all string fields)
 *
 * @param rawDoc - Raw MongoDB document with BSON types matching RawBSONAssetDocument
 * @returns AssetSearchResult with proper JavaScript types
 */
export function convertRawAssetToSearchResult(
  rawDoc: Document
): AssetSearchResult {
  const doc = rawDoc as unknown as RawBSONAssetDocument;

  return {
    // Convert ObjectIds to strings
    id: convertObjectId(doc._id),
    campaignId: convertObjectId(doc.campaignId),

    // Convert BSON Dates to JavaScript Dates
    createdAt: convertDate(doc.createdAt),
    updatedAt: convertDate(doc.updatedAt),

    // Convert ObjectId array to string array
    sessionEventLink: doc.sessionEventLink.map(convertObjectId),

    // Pass through primitive fields (no conversion needed)
    name: doc.name,
    recordType: doc.recordType,
    gmSummary: doc.gmSummary,
    gmNotes: doc.gmNotes,
    playerSummary: doc.playerSummary,
    playerNotes: doc.playerNotes,
    score: doc.score ?? 0,
    locationData: doc.locationData,
    npcData: doc.npcData,
    plotData: doc.plotData,
  };
}
