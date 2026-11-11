import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: no session cookie -> login. The API validates the session for every request.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("simponi_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|login|favicon.ico|icon.svg).*)"],
};
