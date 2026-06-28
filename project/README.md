# 🎮 UNO - Multiplayer Card Game

A modern, mobile-first multiplayer UNO game built with **Next.js 14, React 18, TypeScript, Tailwind CSS, GSAP, and Firebase**. Play 1v1 or in rooms with up to 10 players using unique game codes.

---

## 🎯 About The Game

UNO is a classic card game where players race to empty their hand by matching cards by color or number. This digital version brings the classic experience to your browser with real-time multiplayer, smooth animations, and a beautiful black & white theme.

### Game Objective
Be the first player to get rid of all your cards. Each turn, you must play a card that matches the top card on the discard pile by color, number, or symbol. Use special action cards strategically to gain an advantage over your opponents.

### Key Gameplay Features
- **Real-time Multiplayer**: Play with friends or strangers in real-time
- **Turn-based System**: Clear turn indicators show when it's your turn
- **Smart Card Validation**: Only playable cards are highlighted
- **Tap-to-Play**: Intuitive card selection - tap once to select, tap again to play
- **Auto-Start**: Game begins automatically when 2 players join
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Haptic Feedback**: Vibration feedback on supported devices
- **Smooth Animations**: GSAP-powered card animations and transitions

---

## 🎮 Game Controls

### Desktop Controls
| Action | Control |
|--------|---------|
| **Play a Card** | Click card → Click again to confirm |
| **Draw a Card** | Click "Draw Card" button |
| **Select Color (Wild)** | Click desired color on color picker |
| **Copy Game Code** | Click copy icon next to code |
| **Return to Dashboard** | Click "Back" or "Cancel" button |

### Mobile Controls
| Action | Control |
|--------|---------|
| **Play a Card** | Tap card → Tap again to confirm |
| **Draw a Card** | Tap "Draw Card" button |
| **Select Color (Wild)** | Tap desired color on color picker |
| **Scroll Hand** | Swipe left/right on cards |
| **Copy Game Code** | Tap copy icon next to code |
| **Return to Dashboard** | Tap "Back" or "Cancel" button |

### Game Interface
| Element | Description |
|---------|-------------|
| **Top Bar** | Shows game code and back button |
| **Side Panel** | Displays all players with their card count |
| **Game Board** | Shows discard pile and draw pile |
| **Your Info** | Shows your name, avatar, and card count |
| **Player Hand** | Your cards (scrollable on mobile) |
| **Turn Indicator** | "Your Turn" or "Their Turn" with pulse animation |

---

## 🃏 Card Types & Effects

| Card | Color | Effect |
|------|-------|--------|
| **0-9** | Red, Yellow, Green, Blue | Match by color or number |
| **Skip** | Red, Yellow, Green, Blue | Skips the next player's turn |
| **Reverse** | Red, Yellow, Green, Blue | Reverses turn direction (acts as Skip in 2-player) |
| **Draw Two (+2)** | Red, Yellow, Green, Blue | Next player draws 2 cards and loses their turn |
| **Wild** | None | Play anytime, choose any color |
| **Draw Four (+4)** | None | Next player draws 4 cards and loses their turn, you choose color |

### Card Mechanics
- **Number Cards**: Match by color OR number
- **Action Cards**: Match by color OR symbol
- **Wild Cards**: Can be played on ANY card
- **Color Selection**: After playing a Wild or +4, choose a color
- **Card Stacking**: Multiple +2 or +4 cards cannot be stacked

---

## 🎯 Game Flow

### 1. Create a Game
- Choose **1v1 Battle** or **Room Game**
- A unique 6-character code is generated
- Share the code with friends
- Game code expires in 2 minutes

### 2. Join a Game
- Enter the game code on the dashboard
- Click "Join" to enter the room
- Game starts automatically when 2 players join
- Up to 10 players in room games

### 3. Playing a Turn
1. Wait for "Your Turn" indicator
2. Tap a playable card (highlighted with glow)
3. Tap again to confirm and play
4. OR tap "Draw Card" if you can't play
5. Watch animations for special cards

### 4. Winning the Game
- First player to empty their hand wins
- Winner gets points from opponents' remaining cards
- Stats update automatically
- Win celebration animation plays

---

## 📱 Features

### Authentication
- **Google OAuth**: Secure sign-in with Google account
- **Auto-Profile**: Profile created automatically with Google avatar
- **Persistent Session**: Stay logged in across sessions

### Game Modes
| Mode | Players | Description |
|------|---------|-------------|
| **1v1 Battle** | 2 | Quick head-to-head matches |
| **Room Game** | 2-10 | Multiplayer games with friends |

### Player Statistics
- **Track Wins**: Wins are stored in Firebase
- **Track Losses**: Loss count maintained
- **Win Rate**: Auto-calculated percentage
- **Total Games**: Overall game count
- **Live Update**: Stats update after each game

### UI/UX Features
- **Black & White Theme**: Clean, modern aesthetic
- **Responsive Design**: Works on all screen sizes
- **Touch-Optimized**: 44px minimum touch targets
- **iOS Safe Area**: Proper notch handling
- **Loading States**: Animated progress indicators
- **Toast Notifications**: Non-intrusive feedback

### Technical Features
- **Real-time Sync**: Firestore listeners for instant updates
- **Animations**: GSAP-powered smooth transitions
- **Haptics**: Vibration feedback on Android (audio fallback on iOS)
- **Type Safety**: Full TypeScript coverage
- **Mobile-First**: Optimized for mobile gameplay

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14 | React framework with App Router |
| **React** | 18 | UI library |
| **TypeScript** | 5 | Type safety |
| **Tailwind CSS** | 3.3 | Styling |
| **GSAP** | 3.12 | Animations |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Firebase** | 10 | Backend platform |
| **Firestore** | - | Real-time database |
| **Google OAuth** | - | Authentication |

### Development Tools
| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **PostCSS** | CSS processing |
| **Next.js Dev Server** | Hot reloading |

---

## 🎮 Game Rules

### Basic Rules
1. Each player starts with **7 cards**
2. Players take turns **clockwise**
3. Play a card that matches the **top card** by:
   - Same **color**
   - Same **number** or **symbol**
4. **Wild cards** can be played anytime
5. If you can't play, **draw a card**
6. First to empty hand **wins**

### Special Card Rules
- **Skip**: Next player's turn is skipped
- **Reverse**: Direction changes (2-player acts as Skip)
- **Draw Two (+2)**: Next player draws 2 cards, turn skipped
- **Wild**: Choose any color, can be played anytime
- **Draw Four (+4)**: Next player draws 4 cards, turn skipped, you choose color

### Scoring
- **Winner** gets points from opponents' remaining cards
- **Number Cards**: Face value (0-9 points)
- **Action Cards**: 20 points each (Skip, Reverse, +2)
- **Wild Cards**: 50 points each (Wild, +4)
- **Total Points**: Sum of all opponents' cards

### Turn Flow
1. Player selects a playable card
2. Card is removed from hand
3. Card is added to discard pile
4. Special card effects are applied
5. Turn passes to next player

---

## 🎨 Visual Design

### Theme
- **Primary**: Black & White aesthetic
- **Accent**: UNO card colors (Red, Yellow, Green, Blue)
- **Background**: Light gray (#f5f5f5)
- **Text**: Dark gray (#1a1a1a)
- **Cards**: Colorful with white backgrounds

### Typography
- **Headings**: Fredoka (rounded, playful)
- **Body**: Inter (clean, readable)

### Animations
- **Card Deal**: Staggered entry animation
- **Card Play**: Smooth fly-to-discard animation
- **Card Selection**: Lift effect with glow
- **Turn Change**: Gentle pulse indicator
- **Win**: Celebration overlay with text animation
- **Special Cards**: Screen shake, overlay effects

---

## 🔄 Game Flow Diagram


### Detailed Flow
1. **Login**: Google OAuth → Redirect to Dashboard
2. **Dashboard**: View stats → Create or Join game
3. **Waiting Room**: Share game code → Wait for players
4. **Gameplay**: Turn-based play → Card management
5. **End Game**: Win detection → Points calculation
6. **Stats Update**: Wins/Losses → Database update

---

## 📱 Mobile Optimization

### Features
- **Safe Areas**: iOS notch and home indicator support
- **Touch Targets**: Minimum 44px for all interactive elements
- **Swipe Support**: Horizontal scrolling for card hand
- **Responsive Grid**: Adapts to screen size
- **Portrait Mode**: Optimized for mobile orientation

### Breakpoints
| Device | Breakpoint | Layout |
|--------|------------|--------|
| Mobile | < 640px | Single column, scrollable hand |
| Tablet | 640-1024px | Two column layout |
| Desktop | > 1024px | Full grid layout |

---

## 🎯 How To Play

### Step-by-Step Guide

#### For New Players
1. **Sign in** with your Google account
2. **Create a game**: Click "1v1 Battle" or "Room Game"
3. **Share the code**: Copy and send the 6-character code
4. **Wait for opponent**: Game starts when they join
5. **Play cards**: Match color/number, use special cards
6. **Win**: Be the first to empty your hand

#### For Hosts
1. Click **"Create Game"** or **"Create Room"**
2. Copy the **game code** shown
3. Share it with friends via text/chat
4. Wait for players to join
5. Game starts automatically when 2+ players join

#### For Joiners
1. Enter the **game code** on dashboard
2. Click **"Join"**
3. Wait for game to start
4. Play your cards strategically

---

## 📊 Player Statistics

### Tracked Metrics
- **Total Games**: Number of games played
- **Wins**: Games won
- **Losses**: Games lost
- **Win Rate**: Percentage of wins
- **Current Streak**: Consecutive wins
- **Longest Streak**: Best winning streak

### Stats Update
- Updates automatically after each game
- Real-time sync with Firebase
- Displayed on dashboard

---

## 🎯 Game Tips

### Beginner Tips
- **Save Wild Cards**: Use them strategically when stuck
- **Watch Opponent's Card Count**: Know when they're close to winning
- **Play Action Cards Early**: Use +2 and Skip cards when you have them
- **Change Color Strategically**: When playing Wild, choose a color you have many of

### Advanced Strategies
- **Card Counting**: Track which colors/numbers have been played
- **Color Pressure**: Force opponents to play certain colors
- **Strategic Drawing**: Sometimes drawing is better than playing a weak card
- **UNO Call**: Call UNO when you have 1 card left

---

## 🏆 Winning Conditions

- **Instant Win**: First player to play their last card wins
- **Automatic Detection**: Game detects winner automatically
- **Point Calculation**: Winner gets points from opponents' remaining cards
- **Stats Update**: Wins/losses recorded in Firebase

---

## 🌟 Unique Features

### What Makes This Game Special
- **100% Copyright Free**: Original code, no third-party IP
- **Mobile-First**: Designed for on-the-go gameplay
- **Black & White Theme**: Modern, clean aesthetic
- **Real-time Multiplayer**: Instant sync with Firebase
- **Haptic Feedback**: Enhanced mobile experience
- **Smart UI**: Clear indicators for everything
- **Responsive**: Works on all devices

### Player Experience
- **Intuitive Controls**: Tap card, tap again to play
- **Clear Feedback**: Visual and haptic feedback for actions
- **Smooth Animations**: Professional GSAP animations
- **Immersive**: Engaging gameplay with real-time updates

---

## 🚀 Performance

### Optimizations
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic by Next.js
- **Lazy Loading**: Components load on demand
- **GPU Acceleration**: GSAP uses hardware acceleration
- **Minimal Dependencies**: Lightweight tech stack

### Performance Metrics
- **Fast Loading**: ~2MB production build
- **Smooth Animations**: 60fps with GSAP
- **Real-time Sync**: < 500ms latency
- **Mobile Optimized**: Works on 4G connections

---

## 🔒 Security

### Authentication
- **Google OAuth**: Industry-standard authentication
- **Session Management**: Secure token handling
- **Authorization**: Firebase Security Rules

### Data Protection
- **User Isolation**: Users can only access their own data
- **Game Privacy**: Only room players can read game state
- **Secure Updates**: Transactions prevent race conditions

### Firebase Security Rules
- **Read**: Only authenticated users can read
- **Write**: Only data owners can write
- **Game Rooms**: Only players can update
- **Stats**: Self-update with finished game sharing

---

## ✅ Game Features Checklist

| Feature | Status |
|---------|--------|
| Google Authentication | ✅ |
| 1v1 Games | ✅ |
| Room Games (2-10 players) | ✅ |
| Game Codes | ✅ |
| Real-time Sync | ✅ |
| Turn Management | ✅ |
| Card Validation | ✅ |
| Special Cards | ✅ |
| Wild Card Color Selection | ✅ |
| Auto-Start | ✅ |
| Win Detection | ✅ |
| Points Calculation | ✅ |
| Player Statistics | ✅ |
| Haptic Feedback | ✅ |
| Animations | ✅ |
| Toast Notifications | ✅ |
| Responsive Design | ✅ |
| Mobile-First | ✅ |
| iOS Safe Areas | ✅ |

---

## 🎮 Ready to Play?

**Start playing now:** Sign in with Google, create a game, and challenge your friends!

---

*Built with ❤️ | 100% original code | Production ready*