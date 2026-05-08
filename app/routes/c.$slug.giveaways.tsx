import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";

export async function loader({ params }: LoaderFunctionArgs) {
  return redirect(`/c/${params.slug ?? ""}`);
}
