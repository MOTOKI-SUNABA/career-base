# Career Base

大学生活・研究・就職活動・私生活の予定、ToDo、企業情報、メモをひとつにまとめる個人用Webアプリです。スマートフォンで素早く確認・登録でき、PCでもアプリらしく使えるレスポンシブUIを採用しています。

## 開発目的

情報がカレンダー、メモ帳、就活サイトなどに散らばる問題を解消し、日々の行動と就職活動を一か所で管理することが目的です。localStorageを端末キャッシュとして利用し、任意でSupabaseへ永続化・同期できるMVPとして保存層を分離しています。

## 現在実装されている機能

- 月曜日始まりの月間カレンダー、日付選択、予定の追加・削除
- 未完了／完了ToDo、期限順表示、期限切れ表示、完了切り替え
- 企業の追加・削除、企業名検索、選考状況絞り込み、詳細モーダル
- メモの追加・削除、キーワード検索、カテゴリ絞り込み、全文表示
- 登録済みデータの編集
- JSON形式でのバックアップ・復元・全データ削除
- `localStorage` によるデータ種別ごとの永続化と初回用サンプルデータ
- Supabaseのメール／パスワード認証、新規登録、RLSによるデータ保護、複数端末同期（接続設定時）
- モバイル優先の固定下部ナビゲーション、キーボード操作、フォーカス表示

## 使用技術

- Next.js 16 / React 19
- TypeScript / App Router
- Tailwind CSS 4
- lucide-react
- npm / localStorage
- Supabase Auth / REST API / PostgreSQL / Row Level Security

## セットアップと起動

Node.js 20以上とnpmを用意し、リポジトリ直下で実行します。

```bash
npm install
npm run dev
```

Windows PowerShellの実行ポリシーにより `npm` が実行できない場合は、`npm.cmd install`、`npm.cmd run dev` のように `npm.cmd` を使用します。

ブラウザで `http://localhost:3000` を開くと `/calendar` に移動します。

### Supabase同期を使う場合

1. Supabaseでプロジェクトを作成する
2. SQL Editorで `supabase/migrations/20260713_create_career_base_data.sql` を実行する
3. AuthenticationのSign In / ProvidersでEmailの新規登録を有効にし、Confirm Emailを有効にする
4. AuthenticationのURL ConfigurationでSite URLを公開URL、Redirect URLsに公開版と`http://localhost:3000/**`を登録する
5. 他の利用者へ確認メールを送る場合はCustom SMTPを設定する
6. `.env.example` を参考に、プロジェクト直下へ `.env.local` を作成する

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

ブラウザ用のPublishable keyだけを使用し、Secret keyや`service_role`キーは設定しないでください。`.env.local`はGit管理の対象外です。

接続情報がない場合も、従来どおりlocalStorageだけで利用できます。設定画面からログインした際、クラウドにデータがなければ現在の端末データを保存し、既存データがあればクラウドの内容を端末へ反映します。その後の追加・編集・削除は自動でクラウドへ保存されます。

「クラウドから読込」は端末内データをクラウドの内容で置き換えます。ログアウト時は別ユーザーへの混入を防ぐため端末キャッシュを消去し、次回ログイン時にクラウドから復元します。複数端末で同時に編集した場合は最後に保存された内容が優先されるため、重要な変更の前にはJSONバックアップを作成してください。

静的検査とビルド:

```bash
npm run lint
npm run typecheck
npm run build
```

## ディレクトリ構成

```text
.
├─ src/
│  ├─ app/          # App Routerの各ルートと全体スタイル
│  ├─ components/   # 各ページUIと共通コンポーネント
│  ├─ hooks/        # localStorageコレクションフック
│  ├─ lib/          # 保存・同期処理、日付処理、初期データ
│  └─ types/        # ドメイン型と共有定数
└─ supabase/
   └─ migrations/   # テーブルとRLSポリシーのSQL
```

## 今後追加する機能

- 繰り返し予定、通知、カレンダー表示の強化
- ToDo・メモと企業情報の関連付け
- ダッシュボード、選考進捗の可視化
- Supabaseデータ構造の正規化と同期競合への対応
- パスワード再設定、CAPTCHA、アカウント削除
- テストとアクセシビリティ検証の拡充

このMVPを土台に、設計意図や改善過程も示せる就職活動のポートフォリオとして継続的に改善していく予定です。

## Vercelへの公開

個人・非商用での利用を想定し、VercelのHobbyプランへ公開できます。

1. GitHubで空のリポジトリを作成する
2. このプロジェクトをGitHubへpushする
3. VercelへGitHubアカウントでログインする
4. Vercel Dashboardで「Add New」→「Project」を選択する
5. GitHubへpushしたリポジトリをImportする
6. Framework Presetが「Next.js」であることを確認してDeployする

VercelでもSupabase同期を使う場合は、Project SettingsのEnvironment Variablesへ `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を追加し、Production・Preview・Developmentの必要な環境を選択して再デプロイします。接続情報を設定しない場合、データは従来どおり各ブラウザのlocalStorageに保存されます。
