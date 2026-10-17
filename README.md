# terra-life
A fan-made browser-based life simulator set in the world of Arknights.

アークナイツの世界「テラ」で一般住民の人生を体験するブラウザ型シミュレーターです。現在は開発準備段階で、ゲームは未実装です。表示するのは準備中の最小画面のみです。

## 開発環境

確認環境：Windows／Node.js 24.21.0／npm 11.19.0。React、TypeScript（strict）、Vite、通常のCSSを使用します。直接依存はpackage.jsonに実版を指定し、解決結果はpackage-lock.jsonで固定しています。

Viteと公式ReactプラグインのNode.js要件は20.19以上の20系、または22.12以上です。既存のNode.jsを使用し、グローバル導入やPC設定変更は行っていません。

## 導入と実行

リポジトリルートで実行します。以下はWindows PowerShellでの手順です。npm.ps1が実行ポリシーで拒否される環境では、設定を変更せずnpm.cmdを使用します。他の対応シェルではnpmに読み替えられます。

```powershell
npm.cmd ci --cache .npm-cache --no-fund
npm.cmd run dev
```

開発サーバーの起動ログに表示されるローカルURLをブラウザで開いてください。通常はhttp://localhost:5173/です。「Terra Life」「開発準備段階」「ゲームは未実装です」と表示されます。サーバーはCtrl+Cで停止します。

```powershell
npm.cmd run typecheck
npm.cmd run build
```

| script | 実体・用途 |
| --- | --- |
| dev | vite：開発サーバー |
| typecheck | tsc --project tsconfig.json && tsc --project tsconfig.node.json：画面とVite設定の型確認 |
| build | npm run typecheck && vite build：型確認後にdistへ配布用出力 |
| preview | vite preview：ビルド済みdistのローカル確認用。公開操作ではない |

依存フォルダ、dist、プロジェクト内npmキャッシュはGit対象外です。unit／E2Eテストは未導入で、VitestはM1、PlaywrightはM2で扱います。

## 仕様と作業記録

- [仕様書v0.3.2](docs/terra-life-spec-v0.3.2.md)：確定・採用方針・提案・調整値・保留が混在する統合ドラフト。
- [プロジェクト運用設定](docs/project-context.md)：採用範囲、責務境界、工程と現在地。
- [TL-M0-001](docs/tasks/TL-M0-001.md)：今回の採用判断、実版・互換性の確認元、実装報告、検証結果と未確認事項。

仕様書全体の提案やM1以降を一括採用したものではありません。受入れ・Git反映・公開の状態はタスク記録で区別します。
