import { EditorScreen } from './screens/EditorScreen'
import { HomeScreen } from './screens/HomeScreen'
import { StartScreen } from './screens/StartScreen'
import { useStore } from './store'

export default function App() {
  const screen = useStore((state) => state.screen)
  const toast = useStore((state) => state.toast)

  return (
    <div className="stage">
      <div className="frame">
        {screen === 'start' && <StartScreen />}
        {screen === 'editor' && <EditorScreen />}
        {screen === 'home' && <HomeScreen />}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
