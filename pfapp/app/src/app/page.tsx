import { loadTarget } from "@/lib/target";

export const dynamic = "force-dynamic";

export default function Home() {
  const target = loadTarget();
  return <main>{target.name.en}</main>;
}
