document.addEventListener('DOMContentLoaded', () => {
    // 3D scene variables
    let scene, camera, renderer, bottleMesh, controls; 

    const allPages = document.querySelectorAll('.page');
    let currentUser = null;

    // --- Helper function for date formatting ---
    function formatDate(dateString) {
        if (!dateString || !dateString.includes('-')) {
            return dateString; 
        }
        const datePart = dateString.split(' ')[0];
        const [year, month, day] = datePart.split('-');
        return `${month}/${day}/${year}`;
    }

    // --- Main App Initialization & Router ---
    async function initApp() {
        const loggedInEmployeeId = sessionStorage.getItem('loggedInEmployeeId');
        if (loggedInEmployeeId) {
            try {
                // UPDATED: Sending JSON instead of FormData
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getUser',
                        employee_id: loggedInEmployeeId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user;
                    if(window.location.hash !== '#bottle') {
                        window.location.hash = '#bottle';
                        return;
                    }
                } else {
                    sessionStorage.removeItem('loggedInEmployeeId');
                }
            } catch (error) {
                console.error("Failed to auto-login:", error);
                sessionStorage.removeItem('loggedInEmployeeId');
            }
        }
        
        navigate();
        window.addEventListener('hashchange', navigate);
    }

    async function navigate() {
        const hash = window.location.hash || '#login';
        const pageName = hash.split('?')[0].substring(1); 
        
        allPages.forEach(page => page.classList.add('hidden'));
        let activePage = document.getElementById(pageName + '-page');

        if (pageName === 'bottle' && !currentUser) {
            window.location.hash = '#login';
            return;
        } else if (!activePage) {
            activePage = document.getElementById('login-page');
        }
        
        activePage.classList.remove('hidden');

        if (pageName === 'bottle' && currentUser) {
            await initBottlePage(currentUser);
        } else if (pageName === 'add-sticker') {
            initAddStickerPage(); 
        } else if (pageName === 'admin-dashboard') {
            if (sessionStorage.getItem('isAdmin') === 'true') {
                initAdminDashboard();
            } else {
                 window.location.hash = 'login';
            }
        } else if (pageName === 'login') {
            currentUser = null;
            sessionStorage.removeItem('loggedInEmployeeId');
            sessionStorage.removeItem('isAdmin');
        }
    }
    
    // ===============================================
    //  LOGIN LOGIC
    // ===============================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employeeId = document.getElementById('login-employee-id').value.trim();
            const loginError = document.getElementById('login-error');
            loginError.textContent = '';
            if (!employeeId) return;

            try {
                // UPDATED: Sending JSON instead of FormData
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'getUser',
                        employee_id: employeeId
                    })
                });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user;
                    sessionStorage.setItem('loggedInEmployeeId', currentUser.employee_id);
                    if (currentUser.employee_id === 'cg12420') {
                        sessionStorage.setItem('isAdmin', 'true');
                    }
                    window.location.hash = 'bottle';
                } else {
                    loginError.textContent = data.message || 'User not found.';
                }
            } catch (error) {
                loginError.textContent = 'Failed to connect to the server.';
            }
        });
    }

    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-password-input').value;
            const adminError = document.getElementById('admin-error');
            if (password === 'cg12420') {
                sessionStorage.setItem('isAdmin', 'true');
                sessionStorage.setItem('loggedInEmployeeId', 'cg12420');
                window.location.hash = 'admin-dashboard';
                adminError.textContent = '';
                document.getElementById('admin-password-input').value = '';
            } else {
                adminError.textContent = 'Incorrect password.';
            }
        });
    }

    // ===============================================
    //  BOTTLE CREATION & PAGE LOGIC
    // ===============================================

    function createWaterBottle() {
        const bottleGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00BFFF, roughness: 0.2, metalness: 0.1 });
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        
        const bodyGeo = new THREE.CylinderGeometry(0.8, 0.7, 3, 32);
        bottleMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bottleMesh.name = 'bottleBody';
        bottleGroup.add(bottleMesh);

        const points = [ new THREE.Vector2(0.4, 0), new THREE.Vector2(0.7, 0), new THREE.Vector2(0.7, 0.5), new THREE.Vector2(0.4, 0.8), new THREE.Vector2(0.4, 1.1) ];
        const lidGeo = new THREE.LatheGeometry(points, 32);
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 1.5; 
        bottleGroup.add(lid);

        return bottleGroup;
    }

    function init3DScene(user) {
        const container = document.getElementById('bottle-viewer-container');
        const canvas = document.getElementById('bottle-canvas');
        if (!container || !canvas) return;

        if (renderer) {
            renderer.dispose();
            const oldCanvas = container.querySelector('canvas');
            if(oldCanvas && oldCanvas !== canvas) oldCanvas.remove();
        }

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xd8dde1);
        camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 0, 7);

        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 3;
        controls.maxDistance = 10;
        controls.enablePan = false;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);

        const bottle = createWaterBottle();
        scene.add(bottle);

        if (window.TWEEN) {
            new TWEEN.Tween(bottle.rotation)
                .to({ y: bottle.rotation.y + Math.PI * 2 }, 1500)
                .easing(TWEEN.Easing.Quintic.Out)
                .start();
        }

        if (user && user.stickers && user.stickers.length > 0) {
            if (typeof THREE.DecalGeometry === 'undefined') {
                console.error("DecalGeometry not loaded. Make sure to include it in index.html.");
                return;
            }
            
            const textureLoader = new THREE.TextureLoader();
            const decalSize = new THREE.Vector3(1.2, 1.2, 1.2);

            const decalPositions = [
                { pos: new THREE.Vector3(0, 1.0, 0.85) }, { pos: new THREE.Vector3(0.85, 0.2, 0) },
                { pos: new THREE.Vector3(0, -0.5, -0.85) }, { pos: new THREE.Vector3(-0.85, -0.9, 0) },
                { pos: new THREE.Vector3(0.65, 0.6, 0.65) }, { pos: new THREE.Vector3(-0.65, -0.2, -0.65) },
                { pos: new THREE.Vector3(0.75, -0.8, 0.45) }, { pos: new THREE.Vector3(-0.75, 0.8, -0.45) },
            ];

            user.stickers.slice(0, decalPositions.length).forEach((sticker, index) => {
                textureLoader.load(sticker.image_data, (texture) => {
                    const decalMaterial = new THREE.MeshStandardMaterial({
                        map: texture, transparent: true, depthTest: true,
                        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5,
                        alphaTest: 0.5, roughness: 0.4, metalness: 0.1
                    });
                    
                    const decalInfo = decalPositions[index];
                    const rotationMatrix = new THREE.Matrix4();
                    rotationMatrix.lookAt(decalInfo.pos, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
                    const decalRotation = new THREE.Euler().setFromRotationMatrix(rotationMatrix);
                    
                    const decal = new THREE.Mesh(
                        new THREE.DecalGeometry(bottleMesh, decalInfo.pos, decalRotation, decalSize),
                        decalMaterial
                    );
                    bottleMesh.add(decal);
                });
            });
        }

        function animate() {
            requestAnimationFrame(animate);
            if (window.TWEEN) {
                TWEEN.update();
            }
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
        
        window.onresize = () => {
             if (!container) return;
             camera.aspect = container.clientWidth / container.clientHeight;
             camera.updateProjectionMatrix();
             renderer.setSize(container.clientWidth, container.clientHeight);
        };
    }
    
    async function initBottlePage(user) {
        const bottlePage = document.getElementById('bottle-page');
        
        const existingGear = bottlePage.querySelector('.admin-gear-link');
        if(existingGear) existingGear.remove();

        if (user.employee_id === 'cg12420') {
            const viewerContainer = bottlePage.querySelector('#bottle-viewer-container');
            if (viewerContainer) {
                const gearLink = document.createElement('a');
                gearLink.href = '#admin-dashboard';
                gearLink.className = 'admin-gear-link';
                gearLink.title = 'Go to Admin Dashboard';
                gearLink.innerHTML = `<span class="material-icons">settings</span>`;
                viewerContainer.appendChild(gearLink);
            }
        }
        
        init3DScene(user); 
        loadUserStickers(user);
    }

    function loadUserStickers(user) {
        const grid = document.getElementById('sticker-list-grid');
        if(!grid) return;
        grid.innerHTML = '';

        if (user.stickers && user.stickers.length > 0) {
            user.stickers.forEach(sticker => {
                const stickerEl = document.createElement('div');
                stickerEl.className = 'sticker-item-card';
                stickerEl.dataset.stickerId = sticker.id;
                stickerEl.dataset.description = sticker.description;

                stickerEl.innerHTML = `
                    <div class="sticker-item-main">
                        <img src="${sticker.image_data}" alt="${sticker.event_name}" class="sticker-item-img">
                        <div class="sticker-item-info">
                            <h4>${sticker.event_name}</h4>
                            <p>${formatDate(sticker.event_date)}</p>
                        </div>
                    </div>
                    <div class="sticker-item-details hidden">
                        <p class="sticker-description"></p>
                        <form class="feedback-form">
                            <textarea name="comment" placeholder="Add your feedback for the event..." rows="4"></textarea>
                            <div class="feedback-actions">
                                <button type="submit">Save Feedback</button>
                                <span class="feedback-status"></span>
                            </div>
                        </form>
                    </div>
                `;
                grid.appendChild(stickerEl);
            });
        } else {
            grid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Your sticker collection is empty.</p>';
        }
    }

    const stickerListGrid = document.getElementById('sticker-list-grid');
    if (stickerListGrid) {
        stickerListGrid.addEventListener('click', async (e) => {
            const card = e.target.closest('.sticker-item-card');
            if (!card) return;

            if (e.target.matches('button[type="submit"]')) {
                e.preventDefault();
                const form = e.target.closest('.feedback-form');
                const statusEl = form.querySelector('.feedback-status');
                const stickerId = card.dataset.stickerId;
                const comment = form.querySelector('textarea[name="comment"]').value;

                statusEl.textContent = 'Saving...';
                
                try {
                    const response = await fetch('/api', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'submitFeedback',
                            sticker_id: stickerId,
                            employee_id: currentUser.employee_id,
                            comment: comment
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        statusEl.textContent = 'Saved!';
                    } else {
                        statusEl.textContent = 'Error saving.';
                    }
                } catch (error) {
                    statusEl.textContent = 'Connection error.';
                }
                setTimeout(() => { statusEl.textContent = ''; }, 2500);
                return;
            }
            
            const details = card.querySelector('.sticker-item-details');
            const isExpanded = !details.classList.contains('hidden');

            if (isExpanded) {
                details.classList.add('hidden');
            } else {
                const descriptionEl = card.querySelector('.sticker-description');
                const commentTextarea = card.querySelector('textarea[name="comment"]');
                
                descriptionEl.textContent = card.dataset.description || 'No description provided for this event.';
                commentTextarea.value = 'Loading feedback...';

                const stickerId = card.dataset.stickerId;
                const response = await fetch(`/api?action=getStickerInfo&sticker_id=${stickerId}&employee_id=${currentUser.employee_id}`);
                const data = await response.json();

                if (data.success) {
                    commentTextarea.value = data.user_feedback || '';
                } else {
                    commentTextarea.value = 'Could not load feedback.';
                }

                details.classList.remove('hidden');
            }
        });
    }

    // ===============================================
    //  ADD STICKER PAGE LOGIC
    // ===============================================
    async function initAddStickerPage() {
        const container = document.getElementById('claim-container');
        const stickerImage = document.getElementById('sticker-image');
        const claimButton = document.getElementById('claim-button');
        const idModal = document.getElementById('id-modal');
        const confirmModal = document.getElementById('confirm-modal');
        const registerModal = document.getElementById('register-modal');
        const errorDivs = document.querySelectorAll('#add-sticker-page .error-message');
        errorDivs.forEach(div => div.textContent = '');
        
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const stickerId = urlParams.get('id');
        if (!stickerId) { container.innerHTML = '<h1>Error: No sticker ID provided.</h1>'; return; }

        function showClaimModal(modalToShow) { 
            idModal.classList.add('hidden'); 
            confirmModal.classList.add('hidden'); 
            registerModal.classList.add('hidden'); 
            if (modalToShow) { modalToShow.classList.remove('hidden'); } 
        }

        try { 
            const response = await fetch(`/api?action=getStickerInfo&sticker_id=${stickerId}`); 
            const data = await response.json(); 
            if (data.success) { 
                stickerImage.src = data.sticker.image_data; 
                stickerImage.alt = data.sticker.event_name; 
            } else { 
                container.innerHTML = `<h1>Error: ${data.message}</h1>`; 
            } 
        } catch (error) { 
            container.innerHTML = `<h1>Error: Could not connect to the server.</h1>`; 
        }

        claimButton.onclick = () => showClaimModal(idModal);
        
        document.querySelectorAll('#add-sticker-page .modal-back-button').forEach(button => { 
            button.onclick = () => { 
                const parentModal = button.closest('.modal'); 
                if (parentModal && parentModal.id === 'register-modal') { showClaimModal(idModal); } 
                else if (parentModal && parentModal.id === 'confirm-modal') { showClaimModal(idModal); } 
                else { showClaimModal(null); } 
            }; 
        });

        const idForm = document.getElementById('id-form');
        idForm.onsubmit = async (event) => { 
            event.preventDefault(); 
            const idInput = document.getElementById('employee-id-input'); 
            const employeeId = idInput.value.trim(); 
            const idError = document.getElementById('id-error'); 
            idError.textContent = ''; 
            if (!employeeId) return; 

            const response = await fetch('/api', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getUser', employee_id: employeeId })
            }); 
            const data = await response.json(); 
            if (data.success) { 
                const confirmTitle = document.getElementById('confirm-title'); 
                confirmTitle.textContent = `Add sticker to ${data.user.full_name}'s bottle?`; 
                showClaimModal(confirmModal); 
            } else { 
                showClaimModal(registerModal); 
            } 
        };

        const registerForm = document.getElementById('register-form');
        registerForm.onsubmit = async (event) => { 
            event.preventDefault(); 
            const employeeId = document.getElementById('employee-id-input').value.trim(); 
            const fullNameInput = document.getElementById('full-name-input'); 
            const fullName = fullNameInput.value.trim(); 
            const registerError = document.getElementById('register-error'); 
            registerError.textContent = ''; 

            const response = await fetch('/api', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'registerAndAddSticker', 
                    employee_id: employeeId, 
                    full_name: fullName, 
                    sticker_id: stickerId 
                })
            }); 
            const data = await response.json(); 
            if(data.success) { 
                await showSuccessAndRedirect(registerModal, employeeId); 
            } else { 
                registerError.textContent = data.message || 'Registration failed.'; 
            } 
        };

        const confirmYesButton = document.getElementById('confirm-yes-button');
        confirmYesButton.onclick = async () => { 
            const employeeId = document.getElementById('employee-id-input').value.trim(); 
            
            const response = await fetch('/api', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'addSticker', 
                    employee_id: employeeId, 
                    sticker_id: stickerId 
                })
            }); 
            const data = await response.json(); 
            if (data.success) { 
                await showSuccessAndRedirect(confirmModal, employeeId); 
            } else { 
                alert('An error occurred.'); 
            } 
        };
        
        async function showSuccessAndRedirect(currentModal, employeeId) {
            currentModal.querySelector('.modal-content').innerHTML = `<h2>Success!</h2><p>Sticker added. Redirecting...`;
            sessionStorage.setItem('loggedInEmployeeId', employeeId);
            setTimeout(() => {
                window.location.hash = '#bottle';
                navigate(); 
            }, 1500);
        }
    }
    
    async function initAdminDashboard() {
        // This function will need to be updated to send JSON as well
        // We can tackle this in the next phase
    }

    initApp();
});
