import { FileVideo, Upload } from "lucide-react";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util"
import { api } from "@/lib/axios";

type Status = 'waiting' | 'converting' | 'uploading' | 'generating'  | 'success'
const statusMessages = {
  converting: 'Convertendo...',
  generating: 'Transcrevendo...',
  uploading: 'Carregando...',
  success: 'Sucesso!',
  waiting: 'Carregar Vídeo'

}

export interface VideoInputFormProps {
  onVideoUploaded: (id: string) => void
}

export function VideoInputForm(props: VideoInputFormProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [status, setStatus] = useState<Status>('waiting') 

    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
      const { files } = event.currentTarget

      if (!files) {
        return
      }

      const selectedFile = files[0]
      setVideoFile(selectedFile)
    }

    async function converterVideoToAudio(video: File) {
      console.log('Convert start')

      const ffmpeg = await getFFmpeg()
      
      await ffmpeg.writeFile('input.mp4', await fetchFile(video))

      // ffmpeg.on('log', log => {
      //   console.log(log)
      // })

      ffmpeg.on('progress', progress => {
        console.log('Convert progress: ' + Math.round(progress.progress * 100))
      })

      await ffmpeg.exec([
        '-i',
        'input.mp4',
        '-map',
        '0:a',
        '-b:a',
        '20k',
        '-acodec',
        'libmp3lame',
        'output.mp3'
      ])

      const data = await ffmpeg.readFile('output.mp3')
      const audioFileBlob = new Blob([data], { type: 'audio/mpeg'})
      const audioFile = new File([audioFileBlob], 'audio.mp3', {
        type: 'audio/mpeg'
      })

      console.log('Convert finished')

      return audioFile
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
      event.preventDefault()

      const prompt = promptInputRef.current?.value

      if (!videoFile) {
        return
      }

      setStatus('converting')

      const audioFile = await converterVideoToAudio(videoFile)
      
      const data = new FormData()
      data.append('file', audioFile)

      setStatus('uploading')

      const response = await api.post('/videos', data)
      const videoId = response.data.video.id

      setStatus('generating')
      const result = await api.post(`/videos/${videoId}/transcription`, { prompt })

      console.log({ result })

      setStatus('success')
      
      props.onVideoUploaded(videoId)
    }

    const previewURL = useMemo(() => {
      if (!videoFile) {
        return null
      }

      return URL.createObjectURL(videoFile)

    }, [videoFile])

    return (
        <form onSubmit={handleUploadVideo} className="space-y-4">
            <label
              htmlFor="video"
              className="relative cursor-pointer border w-full flex flex-col gap-2 border-dashed text-muted-foreground items-center justify-center aspect-video hover:bg-primary/5"
            >
              { previewURL ? (
                <video src={previewURL} controls={false} className="pointer-events-none absolute inset-0"></video>
              ) : (
                <>
                  <FileVideo className="w-4 h-4 animate-pulse" />
                  <div className="animate-pulse">Selecionar vídeo</div>
                </>
              )}
            </label>

            <input
              type="file"
              id="video"
              accept="video/mp4"
              className="sr-only"
              onChange={handleFileSelected}
            />

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="transcription_prompt">
                Prompt de transcrição
              </Label>
              <Textarea
                ref={promptInputRef}
                disabled={status !== 'waiting'}
                id="transcription_prompt"
                className="resize-none h-20 leading-relaxed"
                placeholder="Inclua palavras-chave mencionadas no vídeo separadas por vírgula (,)."
              />
            </div>

            <Button 
              data-success={status === 'success'}
              disabled={status !== 'waiting'} 
              type="submit" 
              className="w-full data-[success=true]:bg-emerald-400"
            >
              { statusMessages[status] }
              <Upload className="w-4 h-4 ml-4" />
            </Button>
          </form>
    )
}