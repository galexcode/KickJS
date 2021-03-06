define(["kick/core/ProjectAsset", "kick/core/Constants", "kick/core/Util", "kick/math/Vec2", "kick/core/EngineSingleton"],
    function (ProjectAsset, Constants, Util, Vec2, EngineSingleton) {
        "use strict";

        var DEBUG = Constants._DEBUG;

        /**
         * Encapsulate a texture object and its configuration. Note that the texture configuration
         * must be set prior to assigning the texture (using either init, setImage or setImageData).<br>
         *
         * Cubemaps must have dimensions width = height * 6 and the order of the cubemap is
         * positiveX, negativeX, positiveY, negativeY, positiveZ, negativeZ
         * @class Texture
         * @namespace kick.texture
         * @constructor
         * @param {Object} [config]
         * @extends kick.core.ProjectAsset
         */
        return function (config) {
            // extend ProjectAsset
            ProjectAsset(this, config, "kick.texture.Texture");
            if (Constants._ASSERT) {
                if (config === EngineSingleton.engine) {
                    Util.fail("Texture constructor changed - engine parameter is removed");
                }
            }
            var engine = EngineSingleton.engine,
                gl = engine.gl,
                glState = engine.glState,
                texture0 = Constants.GL_TEXTURE0,
                createImageFunction,
                createImageFunctionParameters,
                _textureId = gl.createTexture(),
                _name = "Texture",
                _wrapS =  Constants.GL_REPEAT,
                _wrapT = Constants.GL_REPEAT,
                _minFilter = Constants.GL_LINEAR,
                _magFilter = Constants.GL_LINEAR,
                _generateMipmaps = true,
                _isMipMapGenerated = false,
                _hasDataOnGPU = false,
                _dataURI =  "memory://void",
                _flipY =  true,
                _type,
                _intFormat = Constants.GL_RGBA,
                _textureType = Constants.GL_TEXTURE_2D,
                _boundTextureType = null,
                thisObj = this,
                _dimension = Vec2.create(),
                /**
                 * @method recreateTextureIfDifferentType
                 * @private
                 */
                recreateTextureIfDifferentType = function () {
                    if (_boundTextureType !== null && _boundTextureType !== _textureType) {
                        gl.deleteTexture(_textureId);
                        _textureId = gl.createTexture();
                    }
                    _boundTextureType = _textureType;
                },
                createMipmaps = function () {
                    gl.generateMipmap(_textureType);
                    _isMipMapGenerated = true;
                },

                contextLost = function () {
                    gl = null;
                },
                contextRestored = function (newGl) {
                    gl = newGl;
                    _textureId = gl.createTexture();
                    if (createImageFunction) {
                        createImageFunction.apply(thisObj, createImageFunctionParameters);
                    }
                };

            /**
             * Trigger getImageData if dataURI is defined
             * @method init
             */
            this.init = function () {
                if (_dataURI) {
                    engine.resourceLoader.getImageData(_dataURI, thisObj);
                }
            };

            /**
             * Applies the texture settings
             * @method apply
             */
            this.apply = function () {
                if (DEBUG) {
                    if (!_generateMipmaps) {
                        if (_minFilter !== Constants.GL_NEAREST &&
                                _minFilter !== Constants.GL_LINEAR) {
                            Util.warn("When generateMipmaps is false min filter must be either GL_NEAREST or GL_LINEAR");
                        }
                    }
                }

                thisObj.bind(0); // bind to texture slot 0
                if (_textureType === Constants.GL_TEXTURE_2D) {
                    gl.texParameteri(Constants.GL_TEXTURE_2D, Constants.GL_TEXTURE_WRAP_S, _wrapS);
                    gl.texParameteri(Constants.GL_TEXTURE_2D, Constants.GL_TEXTURE_WRAP_T, _wrapT);
                }
                gl.texParameteri(_textureType, Constants.GL_TEXTURE_MAG_FILTER, _magFilter);
                gl.texParameteri(_textureType, Constants.GL_TEXTURE_MIN_FILTER, _minFilter);
            };

            /**
             * Bind the current texture
             * @method bind
             */
            this.bind = function (textureSlot) {
                gl.activeTexture(texture0 + textureSlot);
                gl.bindTexture(_textureType, _textureId);
            };

            /**
             * Deallocate the texture from memory
             * @method destroy
             */
            this.destroy = function () {
                if (_textureId !== null) {
                    gl.deleteTexture(_textureId);
                    _textureId = null;
                    engine.project.removeResourceDescriptor(thisObj.uid);
                }
                createImageFunction = null;
                createImageFunctionParameters = null;
                engine.removeEventListener('contextLost', contextLost);
                engine.removeEventListener('contextRestored', contextRestored);
            };

            /**
             * Set texture image based on a image object.<br>
             * The image is automatically resized nearest power of two<br>
             * When a textureType == TEXTURE\_CUBE\_MAP the image needs to be in the following format:
             * <ul>
             *     <li>width = 6*height</li>
             *     <li>Image needs to be ordered: [Right, Left, Top, Bottom, Front, Back] (As in <a href="http://www.cgtextures.com/content.php?action=tutorial&name=cubemaps">NVidia DDS Exporter</a>)</li>
             * </ul>
             * @method setImage
             * @param {Image} imageObj image object to import
             * @param {String} dataURI String representing the image
             */
            this.setImage = function (imageObj, dataURI) {
                createImageFunction = thisObj.setImage;
                createImageFunctionParameters = arguments;
                var width, height, cubemapOrder, srcWidth, srcHeight, canvas, ctx, i;
                _dataURI = dataURI;
                recreateTextureIfDifferentType();
                thisObj.bind(0); // bind to texture slot 0
                if (_textureType === Constants.GL_TEXTURE_2D) {
                    if (!Util.isPowerOfTwo(imageObj.width) || !Util.isPowerOfTwo(imageObj.height)) {
                        width = Util.nextHighestPowerOfTwo(imageObj.width);
                        height = Util.nextHighestPowerOfTwo(imageObj.height);
                        imageObj = Util.scaleImage(imageObj, width, height);
                    }
                    if (_flipY) {
                        gl.pixelStorei(Constants.GL_UNPACK_FLIP_Y_WEBGL, true);
                    } else {
                        gl.pixelStorei(Constants.GL_UNPACK_FLIP_Y_WEBGL, false);
                    }
                    gl.pixelStorei(Constants.GL_UNPACK_ALIGNMENT, 1);
                    gl.texImage2D(Constants.GL_TEXTURE_2D, 0, _intFormat, _intFormat, Constants.GL_UNSIGNED_BYTE, imageObj);
                    Vec2.copy(_dimension, [imageObj.width, imageObj.height]);
                } else {
                    cubemapOrder = [
                        Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_X,
                        Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_X,
                        Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_Y,
                        Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_Y,
                        Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_Z,
                        Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_Z
                    ];
                    srcWidth = imageObj.width / 6;
                    srcHeight = imageObj.height;
                    height = Util.nextHighestPowerOfTwo(imageObj.height);
                    width = height;
                    canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    ctx = canvas.getContext("2d");
                    for (i = 0; i < 6; i++) {
                        ctx.drawImage(imageObj,
                            i * srcWidth, 0, srcWidth, srcHeight,
                            0, 0, width, height);
                        gl.pixelStorei(Constants.GL_UNPACK_FLIP_Y_WEBGL, false);
                        gl.pixelStorei(Constants.GL_UNPACK_ALIGNMENT, 1);
                        gl.texImage2D(cubemapOrder[i], 0, _intFormat, _intFormat, Constants.GL_UNSIGNED_BYTE, canvas);
                    }
                    Vec2.copy(_dimension, [width, height]);
                }
                _type = Constants.GL_UNSIGNED_BYTE;
                thisObj.apply();
                if (_generateMipmaps) {
                    createMipmaps();
                }
                _hasDataOnGPU = true;
                glState.currentMaterial = null; // for material to rebind
            };

            /**
             * Calling this function has the side effect of enabling floating point texture (in available on platform)
             * Use GLState.depthTextureExtension instead
             * @method isFPTexturesSupported
             * @return {Boolean}
             * @deprecated
             */
            this.isFPTexturesSupported = function () {
                var res = gl.isTexFloatEnabled;
                if (typeof res !== 'boolean') {
                    res = gl.getExtension("OES_texture_float"); // this has the side effect of enabling the extension
                    gl.isTexFloatEnabled = res;
                }
                return res;
            };

            /**
             * Updates a subset of the texture
             * Note the type of pixels is assumed to be the same as in setImageData
             * @example
             *     var texture = new kick.texture.Texture();
             *     texture.setImageData(2,2,0,kick.core.Constants.GL_UNSIGNED_BYTE,null);
             *     texture.setSubImageData(0, 0, 1, 1, new Uint8Array([255,255,255,255]));
             * @method setSubImageData
             * @param {Number} xoffset
             * @param {Number} yoffset
             * @param {Number} width
             * @param {Number} height
             * @param {ArrayBufferView} pixels
             */
            this.setSubImageData = function (xoffset, yoffset, width, height, pixels) {
                if (Constants._ASSERT) {
                    if (!_textureType) {
                        Util.fail("Texture.textureType not set");
                        return;
                    }
                    if (!_hasDataOnGPU){
                        Util.fail("Texture.setSubImageData must be called after Texture.setImageData or Texture.setImage");
                    }
                    if (width <=0 || height <=0){
                        Util.fail("Texture.setSubImageData width and height must be larger than 0");
                    }
                    if (xoffset + width > _dimension[0]){
                        Util.fail("Texture.setSubImageData xoffset ("+xoffset+") + width ("+width+") must be less than / equal to texture width ("+_dimension[0]+")");
                    }
                    if (yoffset + height > _dimension[1]){
                        Util.fail("Texture.setSubImageData xoffset ("+yoffset+") + width ("+height+") must be less than / equal to texture width ("+_dimension[1]+")");
                    }
                }
                var i,
                    textureSides = _textureType === Constants.GL_TEXTURE_2D ?
                        [Constants.GL_TEXTURE_2D] :
                        [Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_X,
                            Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_X,
                            Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_Y,
                            Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_Y,
                            Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_Z,
                            Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_Z];
                thisObj.bind(0); // bind to texture slot 0
                glState.currentMaterial = null; // for material to rebind
                gl.pixelStorei(Constants.GL_UNPACK_ALIGNMENT, 1);
                for (i = 0; i < textureSides.length; i++) {
                    gl.texSubImage2D(textureSides[i], 0, xoffset, yoffset, width, height, _intFormat, _type, pixels);
                }
            };

            /**
             * Set a image using a raw bytearray in a specified format.
             * GL\_FLOAT / GL\_HALF\_FLOAT\_OES should only be used if extension is supported (See GLState.textureFloatExtension / GLState.textureFloatHalfExtension).
             * If only one of GL\_FLOAT/GL\_HALF\_FLOAT\_OES is supported, then the engine will silently use the supported type.
             * If used on cubemap-texture then all 6 sides of the cube is assigned
             * @example
             *     texture = new kick.texture.Texture();
             *     var data = new Uint8Array([
             *         255,255,255,255, 255,0,0,255,
             *         0,255,0,255, 0,0,255,255
             *     ]);
             *     texture.setImageData(2,2,0,kick.core.Constants.GL_UNSIGNED_BYTE,data);
             * @method setImageData
             * @param {Number} width image width in pixels
             * @param {Number} height image height in pixels
             * @param {Number} border image border in pixels
             * @param {Object} type GL\_FLOAT, GL\_HALF\_FLOAT_OES, GL\_UNSIGNED\_BYTE, GL\_UNSIGNED\_SHORT\_4\_4\_4\_4, GL\_UNSIGNED\_SHORT\_5\_5\_5\_1 or GL\_UNSIGNED\_SHORT\_5\_6\_5
             * @param {ArrayBufferView} pixels array of pixels (may be null)
             * @param {String} dataURI String representing the image
             * @param {Number} [cubemapIndex] The cubemap index (only for cubemaps) [+x,-x,+y,-y,+z,-z]. Default is all cubemaps.
             */
            this.setImageData = function (width, height, border, type, pixels, dataURI, cubemapIndex) {
                createImageFunction = thisObj.setImageData;
                createImageFunctionParameters = arguments;
                var textureSides = _textureType === Constants.GL_TEXTURE_2D ?
                            [Constants.GL_TEXTURE_2D] :
                            [Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_X,
                                Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_X,
                                Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_Y,
                                Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_Y,
                                Constants.GL_TEXTURE_CUBE_MAP_POSITIVE_Z,
                                Constants.GL_TEXTURE_CUBE_MAP_NEGATIVE_Z];
                recreateTextureIfDifferentType();
                if (type === Constants.GL_FLOAT) {
                    if (!glState.depthTextureExtension) {
                        if (glState.textureFloatHalfExtension) {
                            type = Constants.GL_HALF_FLOAT_OES;
                        } else {
                            Util.fail("OES_texture_float unsupported on the platform. Using GL_UNSIGNED_BYTE instead of GL_FLOAT.");
                            type = Constants.GL_UNSIGNED_BYTE;
                        }
                    }
                }
                if (type === Constants.GL_HALF_FLOAT_OES){
                    if (!glState.textureFloatHalfExtension) {
                        if (glState.depthTextureExtension) {
                            type = Constants.GL_FLOAT;
                        } else {
                            Util.fail("OES_texture_half_float unsupported on the platform. Using GL_UNSIGNED_BYTE instead of GL_HALF_FLOAT_OES.");
                            type = Constants.GL_UNSIGNED_BYTE;
                        }
                    }
                }
                if (Constants._ASSERT) {
                    if (type !== Constants.GL_FLOAT &&
                            type !== Constants.GL_UNSIGNED_BYTE &&
                            type !== Constants.GL_UNSIGNED_SHORT_4_4_4_4  &&
                            type !== Constants.GL_UNSIGNED_SHORT_5_5_5_1 &&
                            type !== Constants.GL_UNSIGNED_SHORT_5_6_5) {
                        Util.fail("Texture.setImageData (type) should be either GL_UNSIGNED_BYTE, GL_UNSIGNED_SHORT_4_4_4_4, GL_UNSIGNED_SHORT_5_5_5_1 or GL_UNSIGNED_SHORT_5_6_5");
                    }
                }
                if (!_textureType) {
                    Util.fail("Texture.textureType not set");
                    return;
                }


                Vec2.copy(_dimension, [width, height]);
                _dataURI = dataURI;

                thisObj.bind(0); // bind to texture slot 0
                gl.pixelStorei(Constants.GL_UNPACK_ALIGNMENT, 1);
                if (typeof cubemapIndex !== "undefined" || _textureType === Constants.GL_TEXTURE_2D){
                    gl.texImage2D(textureSides[cubemapIndex || 0], 0, _intFormat, width, height, border, _intFormat, type, pixels);
                } else {
                    for (var i = 0; i < textureSides.length; i++) {
                        gl.texImage2D(textureSides[i], 0, _intFormat, width, height, border, _intFormat, type, pixels);
                    }
                }

                gl.texParameteri(_textureType, Constants.GL_TEXTURE_MAG_FILTER, _magFilter);
                gl.texParameteri(_textureType, Constants.GL_TEXTURE_MIN_FILTER, _minFilter);
                gl.texParameteri(_textureType, Constants.GL_TEXTURE_WRAP_S, _wrapS);
                gl.texParameteri(_textureType, Constants.GL_TEXTURE_WRAP_T, _wrapT);
                _type = type;
                if (_generateMipmaps) {
                    createMipmaps();
                }
                _hasDataOnGPU = true;
                glState.currentMaterial = null; // for material to rebind
            };

            /**
             * Creates a 2x2 temporary image (white)
             * @method setTemporaryTexture
             */
            this.setTemporaryTexture = function () {
                var whiteImage = new Uint8Array([255, 255, 255, 255,
                        255, 255, 255,255,
                        255, 255, 255,255,
                        255, 255, 255,255]),
                    oldIntFormat = _intFormat;
                this.internalFormat = Constants.GL_RGBA;
                this.setImageData(2, 2, 0, Constants.GL_UNSIGNED_BYTE, whiteImage, "kickjs://texture/white/");
                _intFormat = oldIntFormat;
            };

            /**
             * Allows setting the dataURI without reloading the image
             * @method setDataURI
             * @param newValue
             * @param automaticGetTextureData
             */
            this.setDataURI = function (newValue, automaticGetTextureData) {
                if (newValue !== _dataURI) {
                    _dataURI = newValue;
                    if (automaticGetTextureData) {
                        engine.resourceLoader.getImageData(_dataURI, thisObj);
                    }
                }
            };

            Object.defineProperties(this, {
                /**
                 * @property engine
                 * @type kick.core.Engine
                 */
                engine: {
                    value: engine
                },
                /**
                 * @property textureId
                 * @type Number
                 * @protected
                 */
                textureId: {
                    value: _textureId
                },
                /**
                 * @property name
                 * @type String
                 */
                name: {
                    get: function () {
                        return _name;
                    },
                    set: function (newValue) {
                        _name = newValue;
                    }
                },
                /**
                 * Dimension of texture [width,height].<br>
                 * Note for cube maps the size is for one face
                 * @property dimension
                 * @type {vec2}
                 */
                dimension: {
                    get: function () {
                        return _dimension;
                    }
                },
                /**
                 * URI of the texture. This property does not load any texture. To load a texture, set this property and
                 * call the init function (or load the image manually and call the setImage() function).<br>
                 * If texture is not on same server, then the web server must support CORS<br>
                 * See http://hacks.mozilla.org/2011/11/using-cors-to-load-webgl-textures-from-cross-domain-images/
                 * @property dataURI
                 * @type String
                 */
                dataURI: {
                    get: function () {
                        return _dataURI;
                    },
                    set: function (newValue) {
                        thisObj.setDataURI(newValue, true);
                    }
                },
                /**
                 * Texture.wrapS should be either GL\_CLAMP\_TO\_EDGE or GL\_REPEAT<br>
                 * @property wrapS
                 * @type Object
                 * @default GL_REPEAT
                 */
                wrapS: {
                    get: function () {
                        return _wrapS;
                    },
                    set: function (value) {
                        if (Constants._ASSERT) {
                            if (value !== Constants.GL_CLAMP_TO_EDGE && value !== Constants.GL_REPEAT) {
                                Util.fail("Texture.wrapS should be either GL_CLAMP_TO_EDGE or GL_REPEAT");
                            }
                        }
                        _wrapS = value;
                    }
                },
                /**
                 * Texture.wrapT should be either GL\_CLAMP\_TO\_EDGE or GL\_REPEAT<br>
                 * @property wrapT
                 * @type Object
                 * @default GL_REPEAT
                 */
                wrapT: {
                    get: function () {
                        return _wrapT;
                    },
                    set: function (value) {
                        if (Constants._ASSERT) {
                            if (value !== Constants.GL_CLAMP_TO_EDGE && value !== Constants.GL_REPEAT) {
                                Util.fail("Texture.wrapT should be either GL_CLAMP_TO_EDGE or GL_REPEAT");
                            }
                        }
                        _wrapT = value;
                    }
                },
                /**
                 * Texture.minFilter should be either GL\_NEAREST, GL\_LINEAR, GL\_NEAREST\_MIPMAP\_NEAREST, <br>
                 * GL\_LINEAR\_MIPMAP\_NEAREST, GL\_NEAREST\_MIPMAP\_LINEAR, GL\_LINEAR\_MIPMAP\_LINEAR<br>
                 * @property minFilter
                 * @type Object
                 * @default GL_LINEAR
                 */
                minFilter: {
                    get: function () {
                        return _minFilter;
                    },
                    set: function (value) {
                        if (Constants._ASSERT) {
                            if (value !== Constants.GL_NEAREST &&
                                    value !== Constants.GL_LINEAR &&
                                    value !== Constants.GL_NEAREST_MIPMAP_NEAREST &&
                                    value !== Constants.GL_LINEAR_MIPMAP_NEAREST &&
                                    value !== Constants.GL_NEAREST_MIPMAP_LINEAR &&
                                    value !== Constants.GL_LINEAR_MIPMAP_LINEAR) {
                                Util.fail("Texture.minFilter should be either GL_NEAREST, GL_LINEAR, GL_NEAREST_MIPMAP_NEAREST, GL_LINEAR_MIPMAP_NEAREST, GL_NEAREST_MIPMAP_LINEAR, GL_LINEAR_MIPMAP_LINEAR");
                            }
                        }
                        _minFilter = value;
                    }
                },
                /**
                 * Texture.magFilter should be either GL\_NEAREST or GL\_LINEAR. <br>
                 * @property magFilter
                 * @type Object
                 * @default GL_LINEAR
                 */
                magFilter: {
                    get: function () {
                        return _magFilter;
                    },
                    set: function (value) {
                        if (Constants._ASSERT) {
                            if (value !== Constants.GL_NEAREST && value !== Constants.GL_LINEAR) {
                                Util.fail("Texture.magFilter should be either GL_NEAREST or GL_LINEAR");
                            }
                        }
                        _magFilter = value;
                    }
                },
                /**
                 * Autogenerate mipmap levels<br>
                 * When an existing texture (without mipmaps) has generateMipmaps=true, then mipmaps are created instantly.
                 * @property generateMipmaps
                 * @type Boolean
                 * @default true
                 */
                generateMipmaps: {
                    get: function () {
                        return _generateMipmaps;
                    },
                    set: function (value) {
                        if (Constants._ASSERT) {
                            if (typeof value !== 'boolean') {
                                Util.fail("Texture.generateMipmaps was not a boolean");
                            }
                        }
                        _generateMipmaps = value;
                        if (_generateMipmaps && !_isMipMapGenerated && _hasDataOnGPU) {
                            thisObj.bind(0);
                            createMipmaps();
                        }
                    }
                },
                /**
                 * When importing image flip the Y direction of the image
                 * <br>
                 * This property is ignored for cube maps.
                 * @property flipY
                 * @type Boolean
                 * @default true
                 */
                flipY: {
                    get: function () {
                        return _flipY;
                    },
                    set: function (value) {
                        if (Constants._ASSERT) {
                            if (typeof value !== 'boolean') {
                                Util.fail("Texture.flipY was not a boolean");
                            }
                        }
                        _flipY = value;
                    }
                },
                /**
                 * Specifies the internal format of the image (format on GPU)<br>
                 * Must be one of the following:
                 * GL\_ALPHA,
                 * GL\_RGB,
                 * GL\_RGBA,
                 * GL\_LUMINANCE,
                 * GL\_LUMINANCE_ALPHA
                 * @property internalFormat
                 * @type Number
                 * @default GL_RGBA
                 */
                internalFormat: {
                    get: function () {
                        return _intFormat;
                    },
                    set: function (value) {
                        if (value !== Constants.GL_ALPHA &&
                                value !== Constants.GL_RGB  &&
                                value !== Constants.GL_RGBA &&
                                value !== Constants.GL_LUMINANCE &&
                                value !== Constants.GL_LUMINANCE_ALPHA) {
                            Util.fail("Texture.internalFormat should be either GL_ALPHA, GL_RGB, GL_RGBA, GL_LUMINANCE, or LUMINANCE_ALPHA");
                        }
                        _intFormat = value;
                    }
                },
                /**
                 * Specifies the texture type<br>
                 * Default is GL\_TEXTURE_2D<br>
                 * Must be one of the following:
                 * GL\_TEXTURE_2D,
                 * GL\_TEXTURE_CUBE_MAP
                 * @property textureType
                 * @type Number
                 * @default GL_TEXTURE_2D
                 */
                textureType: {
                    get: function () {
                        return _textureType;
                    },
                    set: function (value) {
                        if (value !== Constants.GL_TEXTURE_2D && value !== Constants.GL_TEXTURE_CUBE_MAP) {
                            Util.fail("Texture.textureType should be either GL_TEXTURE_2D or GL_TEXTURE_CUBE_MAP");
                        }
                        _textureType = value;
                    }
                }
            });

            /**
             * Serializes the data into a JSON object (that can be used as a config parameter in the constructor)<br>
             * Note that the texture data is not serialized in the json format. <br>
             * This means that either setImage() or setImageData() must be called before the texture can be bound<br>
             * @method toJSON
             * @return {Object} config element
             */
            this.toJSON = function () {
                return {
                    uid: thisObj.uid,
                    wrapS: _wrapS,
                    wrapT: _wrapT,
                    minFilter: _minFilter,
                    magFilter: _magFilter,
                    name: _name,
                    generateMipmaps: _generateMipmaps,
                    flipY: _flipY,
                    internalFormat: _intFormat,
                    textureType: _textureType,
                    dataURI: _dataURI
                };
            };

            this.init = function (config) {
                // apply
                Util.applyConfig(thisObj, config, ["uid", "dataURI"]);
                if (config && config.dataURI) {
                    // set dataURI last to make sure that object is configured before initialization
                    thisObj.dataURI = config.dataURI;
                }
            };
            this.init(config);

            engine.addEventListener('contextLost', contextLost);
            engine.addEventListener('contextRestored', contextRestored);
        };

    }
);