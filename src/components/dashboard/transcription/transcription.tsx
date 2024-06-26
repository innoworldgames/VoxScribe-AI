"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Sidebar from "@/components/dashboard/sidebar/sidebar";
import { Button } from "@/components/ui/button";
import { Menu, Loader2, Play, Pause } from "lucide-react";
import { Transcription as TranscriptionType } from "@/types/transcription";
import { db, updateDatabase } from "@/firebase/config";
import { ref, get } from "firebase/database";
import { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TranscriptionProps {
  transcription: TranscriptionType;
  user: User;
  model?: string;
}

const Transcription: React.FC<TranscriptionProps> = ({
  transcription,
  user,
  model,
}) => {
  const [transcript, setTranscript] = useState<string>(
    transcription.transcript
  );
  const [title, setTitle] = useState<string>(transcription.title);
  const [activeTab, setActiveTab] = useState<string>("view");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<string>(
    model ?? "llama3-70b-8192"
  );
  const [language, setLanguage] = useState<string>("auto"); // Default to auto-detect

  const router = useRouter();
  useEffect(() => {
    const checkOwnership = async () => {
      try {
        const transcriptionRef = ref(
          db,
          `users/${user.uid}/transcriptions/${transcription.id}`
        );
        const snapshot = await get(transcriptionRef);
        console.log("Snapshot exists:", snapshot.exists());
        if (!snapshot.exists()) {
          toast.error("You do not have access to this transcription.");
          router.push(user ? "/transcriptions" : "/");
          return;
        }
      } catch (error) {
        console.error("Error checking ownership:", error);
        toast.error("An error occurred while checking ownership.");
      }
    };

    checkOwnership();
  }, [transcription.id, user, router]);

  const transcribeAudio = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        body: JSON.stringify({ audioURL: transcription.audioURL, language }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (response.ok) {
        // If language was set to "auto", update the language state with the detected language
        if (language === "auto" && data.detectedLanguage) {
          setLanguage(data.detectedLanguage);
        }

        const formattedResponse = await fetch("/api/format-text", {
          method: "POST",
          body: JSON.stringify({
            text: data.transcription,
            rephrase: false,
            language: data.detectedLanguage || language,
          }),
          headers: {
            "Content-Type": "application/json",
            model: selectedModel,
          },
        });
        const formattedData = await formattedResponse.json();
        if (formattedResponse.ok) {
          setTranscript(formattedData.formattedText);

          const titleResponse = await fetch("/api/generate-title", {
            method: "POST",
            body: JSON.stringify({
              text: formattedData.formattedText,
              language: data.detectedLanguage || language,
            }),
            headers: {
              "Content-Type": "application/json",
              model: selectedModel,
            },
          });
          const titleData = await titleResponse.json();
          if (titleResponse.ok) {
            setTitle(titleData.title);
            await updateDatabase(
              ref(db, `users/${user.uid}/transcriptions/${transcription.id}`),
              {
                title: titleData.title,
                transcript: formattedData.formattedText,
              }
            );
          } else {
            console.error("Error generating title:", titleData.error);
          }
        } else {
          console.error("Error formatting text:", formattedData.error);
        }
      } else {
        console.error("Error transcribing audio:", data.error);
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!transcription.transcript) {
      transcribeAudio();
    }
  }, [transcription, user.uid]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDatabase(
        ref(db, `users/${user.uid}/transcriptions/${transcription.id}`),
        {
          title: title,
          transcript: transcript,
        }
      );
    } catch (error) {
      console.error("Error saving transcript:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    await transcribeAudio();
  };

  const formatTranscriptForView = (text: string): JSX.Element => {
    const lines = text.split("\n");
    return (
      <>
        {lines.map((line, index) => {
          if (line.trim() === "") {
            return <br key={index} />;
          }
          if (line.startsWith("# ")) {
            return (
              <h1 key={index} className="text-2xl font-bold mb-2">
                {line.slice(2)}
              </h1>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h2 key={index} className="text-xl font-bold mb-2">
                {line.slice(3)}
              </h2>
            );
          }
          if (line.startsWith("### ")) {
            return (
              <h3 key={index} className="text-lg font-bold mb-2">
                {line.slice(4)}
              </h3>
            );
          }
          if (line.startsWith("* ")) {
            return (
              <ul key={index} className="list-disc list-inside mb-2">
                <li>{line.slice(2)}</li>
              </ul>
            );
          }
          const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
          return (
            <p key={index} className="mb-2">
              {parts.map((part, partIndex) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith("*") && part.endsWith("*")) {
                  return <em key={partIndex}>{part.slice(1, -1)}</em>;
                }
                return part;
              })}
            </p>
          );
        })}
      </>
    );
  };

  const handlePlayAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioProgress(
        (audioRef.current.currentTime / audioRef.current.duration) * 100
      );
    }
  };

  const handleAudioSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekTime =
        (audioRef.current.duration / 100) * Number(event.target.value);
      audioRef.current.currentTime = seekTime;
      setAudioProgress(Number(event.target.value));
    }
  };

  // Add a language selector component
  const LanguageSelector = () => (
    <Select value={language} onValueChange={setLanguage}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto</SelectItem>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="de">German</SelectItem>
        <SelectItem value="fr">French</SelectItem>
        <SelectItem value="es">Spanish</SelectItem>
        <SelectItem value="it">Italian</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="container mx-auto px-4 lg:p-8 p-16 flex flex-col md:flex-row relative">
        <Button
          variant="ghost"
          className="absolute left-2 top-2 lg:hidden"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu className="cursor-pointer text-lg" />
        </Button>
        <main className="flex-1 overflow-y-auto">
          <Card className="flex-1 flex flex-col relative">
            <CardHeader className="pb-2 pt-4 flex flex-col items-center justify-between">
              <div className="flex space-x-2 mb-2 w-full justify-center">
                <Button
                  variant={activeTab === "view" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("view")}
                >
                  View
                </Button>
                <Button
                  variant={activeTab === "edit" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("edit")}
                >
                  Edit
                </Button>
              </div>
              <div className="flex items-center justify-center pb-4 space-x-2">
                <Select
                  value={selectedModel}
                  onValueChange={(value) => setSelectedModel(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llama3-70b-8192">LLama3 70B</SelectItem>
                    <SelectItem value="llama3-8b-8192">Llama3 8B</SelectItem>
                    <SelectItem value="gemma-7b-it">Gemma 7B</SelectItem>
                  </SelectContent>
                </Select>
                <LanguageSelector />
              </div>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CardTitle>{title}</CardTitle>
              )}
            </CardHeader>
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {" "}
                {/* Scrollable transcription content */}
                <CardContent>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : activeTab === "view" ? (
                    formatTranscriptForView(transcript)
                  ) : (
                    <>
                      <div className="relative">
                        <Textarea
                          value={transcript}
                          onChange={(e) => setTranscript(e.target.value)}
                          placeholder="Enter your transcript here..."
                          className="pr-36 scrollbar-hide bg-slate-100"
                        />
                      </div>
                      <div className="flex mt-4 space-x-2">
                        <Button onClick={handleSave} disabled={isSaving}>
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </div>
              <CardFooter className="flex justify-center items-center w-full p-4 bg-white">
                <Button variant="outline" onClick={handlePlayAudio}>
                  {isPlaying ? <Pause /> : <Play />}
                </Button>
                <div className="flex-1 mx-4">
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={audioProgress}
                    onChange={handleAudioSeek}
                    className="w-full"
                  />
                </div>

                <Button onClick={handleRegenerate} disabled={isLoading}>
                  Regenerate
                </Button>
              </CardFooter>
            </div>
          </Card>
        </main>
      </div>
      <audio
        ref={audioRef}
        src={transcription.audioURL}
        onTimeUpdate={handleAudioTimeUpdate}
      />
    </div>
  );
};

export default Transcription;
