# フロントエンド修正時の反映・デプロイ手順

## 手順

1. **コードを修正**
   `frontend/src`配下のソースコードを修正する。

2. **型チェック**
   ```bash
   npm run typecheck
   ```
   型エラーがないか確認する。

3. **ローカルで動作確認**
   ```bash
   npm run dev
   ```
   ブラウザで見た目・動作を確認する。この時点では`.env`の本物のAPI URLに接続されたままなので、実際のLambdaと連携した状態で確認できる。

4. **GitHub Pagesにデプロイ**
   ```bash
   npm run deploy
   ```
   これは`npm run build`(distフォルダにビルド)→`gh-pages -d dist`(GitHub Pagesへ公開)を自動で行う。「Published」が表示されれば公開完了。

5. **ソースをGitにpush**
   ```bash
   git add .
   git commit -m "変更内容の説明"
   git push
   ```
   手順4とは別の作業。`gh-pages`ブランチ(ビルド成果物)と`main`ブランチ(ソースコード)は別管理なので、両方忘れずに行う必要がある。

6. **公開内容を最終確認**
   公開済みのGitHub Pages URL(`https://<ユーザー名>.github.io/queue-system/`)をリロードし、修正が反映されているか確認する。キャッシュの影響で反映が遅れる場合は、シフトリロードやシークレットウィンドウで確認する。

## 補足

- **手順4(デプロイ)と5(Git push)は独立した作業**。`npm run deploy`は`gh-pages`ブランチ(ビルド成果物専用)にしか反映されないため、ソースコード自体を`main`ブランチに残すには別途`git push`が必要。どちらか一方だけだと、「画面には反映されているがソースはGitHub上で古いまま」、あるいは逆の状態になってしまう。
- **環境変数(`.env`)を変更した場合**は、`npm run dev`ではなく`npm run deploy`(内部で`vite build`)を実行しないと反映されない(Viteの環境変数はビルド時に埋め込まれる仕組みのため)。
- **バックエンド(Lambda)側のコードを修正した場合**は、これとは別にdeployment-guide.md 10章の手順(`npm run build`→zip化→`aws lambda update-function-code`)に従う。
