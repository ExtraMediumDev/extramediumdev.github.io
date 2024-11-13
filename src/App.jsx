import React, { useRef } from 'react';
import Scene3D from './components/Scene3D';
import './App.css';

const App = () => {
  const wrapperRef = useRef(null);

  return (

    <div className='relative z-0 bg-primary'>
      <div id="scene-container" className="fixed inset-0 -z-10 h-screen w-screen">
        <Scene3D />
      </div>
    </div>

  );
}

export default App;
