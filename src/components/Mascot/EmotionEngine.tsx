import type { Emotion } from "../../lib/emotion";
import WalleMascot from "./WalleMascot";

export default function EmotionEngine({ emotion }: { emotion: Emotion }) {
  return <WalleMascot emotion={emotion} />;
}
