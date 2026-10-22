# terra-life
A fan-made browser-based life simulator set in the world of Arknights.

アークナイツの世界「テラ」で一般住民の人生を体験するブラウザ型シミュレーターです。M1の乱数基盤（TL-M1-001）は独立レビューを経て、2026-10-20 20:24 JSTにユーザー受入れ済みです。M1全体は進行中です。プレイ可能なゲームは未実装で、表示するのは準備中の最小画面のみです。

出生抽選・開始前の再抽選・開始確定（TL-M1-002）は別Work（Astra）の独立レビューを経て、2026-10-22 JSTにユーザー受入れ・完了しました。家庭5区分は本人の資金と別に保持し、出生時の家庭別抽選は初期資金に限定しています。候補表は検証用の暫定値です。

## 開発環境

確認環境：Windows／Node.js 24.21.0／npm 11.19.0。React、TypeScript（strict）、Vite、通常のCSSを使用します。直接依存はpackage.jsonに実版を指定し、解決結果はpackage-lock.jsonで固定しています。

Viteと公式ReactプラグインのNode.js要件は20.19以上の20系、または22.12以上です。Vitest 4.1.12はNode.js 20系・22系・24以上とVite 6〜8に対応します。実行確認は上記Node.js 24環境で行い、既存のengines設定を維持しています。グローバル導入やPC設定変更は行っていません。

## 導入と実行

リポジトリルートで実行します。以下はWindows PowerShellでの手順です。npm.ps1が実行ポリシーで拒否される環境では、設定を変更せずnpm.cmdを使用します。他の対応シェルではnpmに読み替えられます。

```powershell
npm.cmd ci --cache .npm-cache --no-fund
npm.cmd run dev
```

開発サーバーの起動ログに表示されるローカルURLをブラウザで開いてください。通常はhttp://localhost:5173/です。「Terra Life」「開発準備段階」「ゲームは未実装です」と表示されます。サーバーはCtrl+Cで停止します。

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

| script | 実体・用途 |
| --- | --- |
| dev | vite：開発サーバー |
| test | vitest run：Node環境で乱数の固定値と出生抽選・再抽選・開始固定、系列分離・再開・不正入力を検証し、一度で終了 |
| typecheck | tsc --project tsconfig.json && tsc --project tsconfig.node.json && tsc --project tsconfig.test.json：画面・コア・テスト・Vite／Vitest設定の型確認 |
| build | npm run typecheck && vite build：型確認後にdistへ配布用出力 |
| preview | vite preview：ビルド済みdistのローカル確認用。公開操作ではない |

依存フォルダ、dist、プロジェクト内npmキャッシュはGit対象外です。VitestはTL-M1-001で導入。固定参照値の出所・Cコードによる再生成は[参照fixtureの説明](tests/reference/README.md)に記録しています。通常のテスト実行にCコンパイラは不要です。PlaywrightとE2Eは未導入で、M2で扱います。

## 仕様と作業記録

- [現行仕様書v0.3.5](docs/terra-life-spec-v0.3.5.md)：D08・D09と仕事イベントの基本方針を反映。確定・採用方針・提案・調整値・保留が混在する統合ドラフト。
- [M1コア設計案](docs/design/TL-M1-DESIGN.md)：Draft 10。採用範囲と未決事項、既存の文書同期報告を保持。
- [TL-M1-001](docs/tasks/TL-M1-001.md)：乱数3系列とVitestの実装・検証・独立レビュー・受入記録。完了。受入記録時点の未commit・未pushは履歴として保持。現在のローカルHEADは同範囲のcommit `c5df0c48fd0f8f1692c43e1e651608583fc339d8`。
- [TL-M1-002](docs/tasks/TL-M1-002.md)：出生抽選・再抽選・開始時固定の採用差分、検証値と結果。独立レビュー・ユーザー受入れ済み、完了。今回の変更は未stage・未commit・未push。
- [プロジェクト運用設定](docs/project-context.md)：採用範囲、責務境界、工程と現在地。
- [TL-M0-001](docs/tasks/TL-M0-001.md)：受入済みM0の採用判断、実版・互換性の確認元、実装報告、検証結果と受入記録。
- [旧仕様書v0.3.2](docs/terra-life-spec-v0.3.2.md)：M0の基準として保持する履歴。
- [旧仕様書v0.3.3](docs/terra-life-spec-v0.3.3.md)：前回の文書同期を保持する履歴。現行の採用判断はv0.3.5と設計書を参照。

仕様書全体の提案やM1以降を一括採用したものではありません。受入れ・Git反映・公開の状態はタスク記録で区別します。
