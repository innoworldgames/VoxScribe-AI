import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import SignupDialog from "./signup-dialog";
import { useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase/config";

export default function Header() {
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [user, loading] = useAuthState(auth);

  return (
    <header className="flex justify-between items-center py-3 px-4 bg-white border-b shadow-lg">
      <Link href="/" className="flex items-center">
        <Image
          src="/logo.png"
          alt="VoxScribe Logo"
          width={32}
          height={32}
          className="mr-2"
        />
        <span className="text-xl font-bold text-primary sm:hidden">VSX</span>
        <span className="text-xl font-bold text-primary hidden sm:inline">
          VoxScribe
        </span>
      </Link>
      <nav>
        {user ? (
          <Link href="/transcriptions" passHref>
            <Button className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1">
              Go to Dashboard
            </Button>
          </Link>
        ) : (
          <Button
            disabled={loading}
            onClick={() => setIsSignupOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1"
          >
            Sign Up
          </Button>
        )}
        <SignupDialog
          isOpen={isSignupOpen}
          onClose={() => setIsSignupOpen(false)}
          onSuccess={() => {
            // Handle successful signup
          }}
        />
      </nav>
    </header>
  );
}
