@echo off
cd "c:\Users\Josep Calafat\Documents\GitHub\platform"
echo bookfast > vercel_input.txt
echo pro.bookfast >> vercel_input.txt
type vercel_input.txt | npx vercel link --yes
del vercel_input.txt
npx vercel env pull --yes
